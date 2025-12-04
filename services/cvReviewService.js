require("dotenv").config();
const {GoogleGenerativeAI} = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const {v4: uuidv4} = require("uuid");
const CVReview = require("../models/CVReview");

// PDF parser - will be initialized
let pdfParseFunction = null;

// Initialize PDF parser with new API support
function initPdfParser() {
	try {
		const pdfParseModule = require("pdf-parse");

		if (typeof pdfParseModule === "function") {
			pdfParseFunction = pdfParseModule;
			console.log("PDF parser initialized (legacy API)");
			return;
		}

		if (pdfParseModule.PDFParse) {
			const PDFParse = pdfParseModule.PDFParse;

			if (typeof PDFParse === "function") {
				if (PDFParse.prototype && PDFParse.prototype.constructor === PDFParse) {
					pdfParseFunction = async (buffer, options = {}) => {
						const parser = new PDFParse(options);
						return await parser.parse(buffer);
					};
				} else {
					pdfParseFunction = PDFParse;
				}
				console.log("PDF parser initialized (new API)");
				return;
			}
		}

		for (const key of Object.keys(pdfParseModule)) {
			if (
				typeof pdfParseModule[key] === "function" &&
				key.toLowerCase().includes("parse")
			) {
				pdfParseFunction = pdfParseModule[key];
				console.log(`PDF parser initialized using ${key}`);
				return;
			}
		}

		throw new Error("Could not find PDF parse function in module");
	} catch (error) {
		console.error("Failed to initialize PDF parser:", error.message);
		pdfParseFunction = null;
	}
}

initPdfParser();

class CVReviewService {
	constructor() {
		// Validate API key first
		if (!process.env.GEMINI_API_KEY) {
			console.error("❌ GEMINI_API_KEY is not set in environment variables!");
			throw new Error("GEMINI_API_KEY is required");
		}

		this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

		// 🎯 FIXED: Use correct model name with proper fallback
		const modelName = process.env.GEMINI_MODEL_CV || "gemini-2.5-flash";

		console.log(`🤖 Initializing Gemini AI with model: ${modelName}`);
		console.log(
			`🔑 API Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`
		);

		try {
			this.model = this.genAI.getGenerativeModel({
				model: modelName,
				generationConfig: {
					temperature: 0.7,
					topP: 0.95,
					topK: 40,
					maxOutputTokens: 8192,
				},
			});

			// Fallback model
			this.fallbackModel = this.genAI.getGenerativeModel({
				model: "gemini-flash-latest", // This auto-updates
				generationConfig: {
					temperature: 0.7,
					maxOutputTokens: 8192,
				},
			});

			this.modelName = modelName;
			console.log("✅ Gemini AI models initialized successfully");
		} catch (error) {
			console.error("❌ Failed to initialize Gemini models:", error);
			throw error;
		}

		this.encryptionKey =
			process.env.CV_ENCRYPTION_KEY || "default-32-char-encryption-key!!";
		this.storagePath = process.env.CV_STORAGE_PATH || "./uploads/cvs";
		this.initializeStorage();
	}

	async initializeStorage() {
		try {
			await fs.mkdir(this.storagePath, {recursive: true});
			await fs.mkdir(path.join(this.storagePath, "encrypted"), {
				recursive: true,
			});
		} catch (error) {
			console.error("Error creating storage directories:", error);
		}
	}

	async extractTextFromPDF(buffer) {
		try {
			if (!pdfParseFunction) {
				initPdfParser();

				if (!pdfParseFunction) {
					throw new Error(
						"PDF parser not available. Please install pdf-parse@1.1.1: npm install pdf-parse@1.1.1"
					);
				}
			}

			const data = await pdfParseFunction(buffer);

			const text = data.text || data.getText?.() || "";
			const pages = data.numpages || data.numPages || data.pages || 0;
			const info = data.info || data.metadata || {};

			return {
				text,
				pages,
				info,
			};
		} catch (error) {
			console.error("PDF extraction error:", error);

			if (error.message.includes("not available")) {
				throw error;
			}

			throw new Error(`PDF parsing failed: ${error.message}`);
		}
	}

	encryptFile(buffer) {
		const encrypted = CryptoJS.AES.encrypt(
			buffer.toString("base64"),
			this.encryptionKey
		).toString();
		return encrypted;
	}

	decryptFile(encryptedData) {
		const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
		return Buffer.from(decrypted.toString(CryptoJS.enc.Utf8), "base64");
	}

	generateFileHash(buffer) {
		return crypto.createHash("sha256").update(buffer).digest("hex");
	}

	// 🔧 FIXED: Better error handling and logging
	async analyzeWithGemini(cvText, targetRole = null, experienceLevel = null) {
		const prompt = this.buildAnalysisPrompt(
			cvText,
			targetRole,
			experienceLevel
		);

		let lastError = null;

		// Try primary model
		try {
			console.log(`🔍 Analyzing CV with ${this.modelName}...`);
			console.log(`📝 CV text length: ${cvText.length} characters`);
			console.log(`📝 Prompt length: ${prompt.length} characters`);

			const result = await this.model.generateContent(prompt);
			const response = await result.response;

			// 🆕 Check if response is blocked or has issues
			if (!response) {
				throw new Error("No response received from AI");
			}

			// 🆕 Check for safety ratings or blocked content
			const candidates = result.response.candidates;
			if (candidates && candidates[0]?.finishReason === "SAFETY") {
				console.error("❌ Content was blocked by safety filters");
				throw new Error("Content blocked by safety filters");
			}

			const text = response.text();

			if (!text || text.trim().length === 0) {
				throw new Error("Empty response from AI");
			}

			console.log("✅ AI analysis completed successfully");
			console.log(`📝 Response length: ${text.length} characters`);
			console.log(`📝 Response preview: ${text.substring(0, 200)}...`);

			return this.parseAIResponse(text);
		} catch (error) {
			console.error(
				`❌ Primary model (${this.modelName}) failed:`,
				error.message
			);
			console.error("Full error details:", error);
			lastError = error;

			// Check for specific errors
			if (
				error.message?.includes("API_KEY") ||
				error.message?.includes("API key")
			) {
				throw new Error(`Invalid Gemini API key. Error: ${error.message}`);
			}

			if (
				error.message?.includes("quota") ||
				error.message?.includes("RESOURCE_EXHAUSTED")
			) {
				console.error("❌ Quota exceeded. Please check your API limits.");
			}

			if (
				error.message?.includes("not found") ||
				error.message?.includes("does not exist")
			) {
				console.error(
					`❌ Model ${this.modelName} not found. Check available models.`
				);
			}
		}

		// Try fallback model
		try {
			console.log("⚠️ Trying fallback model (gemini-flash-latest)...");
			const fallbackResult = await this.fallbackModel.generateContent(prompt);
			const fallbackResponse = await fallbackResult.response;

			if (!fallbackResponse) {
				throw new Error("No response from fallback model");
			}

			const fallbackText = fallbackResponse.text();

			if (!fallbackText || fallbackText.trim().length === 0) {
				throw new Error("Empty response from fallback model");
			}

			console.log("✅ Fallback AI analysis completed");
			console.log(
				`📝 Fallback response preview: ${fallbackText.substring(0, 200)}...`
			);

			return this.parseAIResponse(fallbackText);
		} catch (fallbackError) {
			console.error("❌ Fallback model also failed:", fallbackError.message);
			console.error("Full fallback error:", fallbackError);
			lastError = fallbackError;
		}

		// Both models failed - log detailed error
		console.error("❌❌❌ BOTH AI MODELS FAILED ❌❌❌");
		console.error("Last error message:", lastError?.message);
		console.error("Last error stack:", lastError?.stack);
		console.error("Error type:", lastError?.constructor?.name);

		// 🆕 Check if it's a quota/rate limit issue
		if (
			lastError?.message?.includes("quota") ||
			lastError?.message?.includes("429") ||
			lastError?.message?.includes("RESOURCE_EXHAUSTED")
		) {
			console.error("💡 This appears to be a quota/rate limit issue");
			console.error("💡 Check: https://ai.dev/usage");
		}

		// Return basic analysis
		console.log("⚠️ Falling back to basic analysis");
		return this.getBasicAnalysis(cvText);
	}

	buildAnalysisPrompt(cvText, targetRole, experienceLevel) {
		const truncatedCV = cvText.substring(0, 15000);

		return `You are an expert CV/Resume reviewer and ATS specialist with 15+ years of experience.

**CV CONTENT**:
${truncatedCV}

${targetRole ? `**TARGET ROLE**: ${targetRole}` : ""}
${experienceLevel ? `**EXPERIENCE LEVEL**: ${experienceLevel}` : ""}

Provide a comprehensive analysis as a JSON object. Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "overallScore": 85,
  "atsScore": 78,
  "strengths": [
    {
      "category": "Content Quality",
      "point": "Strong quantifiable achievements in work experience",
      "impact": "High"
    }
  ],
  "weaknesses": [
    {
      "category": "Formatting",
      "issue": "Inconsistent date formatting",
      "severity": "Minor",
      "suggestion": "Use consistent date format throughout (e.g., MM/YYYY)"
    }
  ],
  "formatting": {
    "score": 80,
    "issues": ["Minor inconsistencies in spacing"],
    "recommendations": ["Use consistent font sizes", "Align dates properly"]
  },
  "keywords": {
    "found": ["project management", "leadership", "data analysis"],
    "missing": ["agile", "stakeholder management"],
    "industryRelevant": ["budget management", "team coordination"],
    "overused": ["responsible for"],
    "suggestions": ["Add specific technical tools used", "Include certifications"]
  },
  "sections": {
    "present": ["Contact Information", "Work Experience", "Education", "Skills"],
    "missing": ["Professional Summary", "Certifications"],
    "order": ["Contact", "Summary", "Experience", "Education", "Skills", "Certifications"],
    "recommendations": ["Add a compelling professional summary", "Include relevant certifications"]
  },
  "improvementRoadmap": [
    {
      "priority": "Immediate",
      "action": "Add a professional summary highlighting key achievements",
      "expectedImpact": "Immediately captures recruiter attention",
      "timeRequired": "15 minutes"
    }
  ],
  "industrySpecific": {
    "industry": "Business Administration",
    "relevanceScore": 75,
    "recommendations": ["Emphasize business analysis skills", "Add examples of process improvements"],
    "competitorsKeywords": ["strategic planning", "financial analysis", "operations management"]
  },
  "summary": {
    "brief": "Well-structured CV with room for improvement in keyword optimization and professional summary.",
    "topThreeStrengths": ["Clear work history", "Relevant education", "Good contact information"],
    "topThreeImprovements": ["Add professional summary", "Include more metrics", "Optimize ATS keywords"],
    "estimatedImprovementTime": "2-3 hours"
  }
}`;
	}

	parseAIResponse(responseText) {
		try {
			let cleanText = responseText.trim();

			// Remove markdown code blocks
			cleanText = cleanText.replace(/^```json\s*/i, "");
			cleanText = cleanText.replace(/^```\s*/i, "");
			cleanText = cleanText.replace(/\s*```$/i, "");
			cleanText = cleanText.trim();

			// Find JSON object
			const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn("⚠️ No JSON object found in AI response");
				console.log("Response preview:", responseText.substring(0, 200));
				throw new Error("No JSON found in response");
			}

			const parsed = JSON.parse(jsonMatch[0]);
			console.log("✅ Successfully parsed AI response");

			return this.validateAndCleanAnalysis(parsed);
		} catch (error) {
			console.error("❌ Error parsing AI response:", error.message);
			console.log("Raw response preview:", responseText.substring(0, 500));
			return this.getDefaultAnalysis();
		}
	}

	getBasicAnalysis(cvText) {
		const wordCount = cvText.split(/\s+/).length;
		const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(
			cvText
		);
		const hasPhone =
			/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/.test(cvText);
		const hasLinkedIn = /linkedin\.com/i.test(cvText);

		const commonKeywords = [
			"experience",
			"education",
			"skills",
			"projects",
			"achievements",
		];
		const foundKeywords = commonKeywords.filter((kw) =>
			cvText.toLowerCase().includes(kw)
		);

		return {
			overallScore: Math.min(70, 30 + foundKeywords.length * 8),
			atsScore: Math.min(60, 20 + foundKeywords.length * 8),
			strengths: [
				hasEmail && {
					category: "Contact Information",
					point: "Email address is present",
					impact: "High",
				},
				hasPhone && {
					category: "Contact Information",
					point: "Phone number is present",
					impact: "High",
				},
				wordCount > 200 && {
					category: "Content",
					point: "Sufficient content length",
					impact: "Medium",
				},
			].filter(Boolean),
			weaknesses: [
				!hasEmail && {
					category: "Contact Information",
					issue: "Missing email address",
					severity: "Critical",
					suggestion: "Add your professional email address",
				},
				!hasLinkedIn && {
					category: "Professional Network",
					issue: "No LinkedIn profile mentioned",
					severity: "Minor",
					suggestion: "Add your LinkedIn profile URL",
				},
				wordCount < 200 && {
					category: "Content",
					issue: "CV appears to be too brief",
					severity: "Major",
					suggestion: "Add more details about your experience and achievements",
				},
			].filter(Boolean),
			formatting: {
				score: 50,
				issues: ["Unable to fully analyze formatting from text"],
				recommendations: [
					"Ensure consistent formatting throughout the document",
				],
			},
			keywords: {
				found: foundKeywords,
				missing: commonKeywords.filter((kw) => !foundKeywords.includes(kw)),
				industryRelevant: [],
				overused: [],
				suggestions: [
					"Add industry-specific keywords",
					"Include technical skills",
				],
			},
			sections: {
				present: foundKeywords,
				missing: commonKeywords.filter((kw) => !foundKeywords.includes(kw)),
				order: ["Contact", "Summary", "Experience", "Education", "Skills"],
				recommendations: ["Ensure all major sections are present"],
			},
			improvementRoadmap: [
				{
					priority: "Immediate",
					action: "Ensure all contact information is present",
					expectedImpact: "Essential for recruiters to contact you",
					timeRequired: "5 minutes",
				},
				{
					priority: "Short-term",
					action: "Add quantifiable achievements",
					expectedImpact: "Significantly improves impact",
					timeRequired: "30 minutes",
				},
			],
			industrySpecific: {
				industry: "General",
				relevanceScore: 50,
				recommendations: ["Tailor CV to specific industry"],
				competitorsKeywords: [],
			},
			summary: {
				brief:
					"⚠️ Basic analysis only - AI analysis failed. Please check API key and model configuration.",
				topThreeStrengths: foundKeywords
					.slice(0, 3)
					.map((kw) => `Contains ${kw} section`),
				topThreeImprovements: [
					"Add more specific details",
					"Include quantifiable achievements",
					"Optimize for ATS systems",
				],
				estimatedImprovementTime: "1-2 hours",
			},
		};
	}

	// Validate and clean analysis data
	validateAndCleanAnalysis(analysis) {
		// 🆕 Helper function to map severity
		const mapSeverity = (severity) => {
			const severityMap = {
				high: "Critical",
				critical: "Critical",
				major: "Major",
				medium: "Major", // Map Medium to Major
				moderate: "Major",
				minor: "Minor",
				low: "Minor",
				small: "Minor",
			};

			const normalized = (severity || "Minor").toLowerCase();
			return severityMap[normalized] || "Minor";
		};

		// 🆕 Helper function to map priority
		const mapPriority = (priority) => {
			const priorityMap = {
				immediate: "Immediate",
				urgent: "Immediate",
				critical: "Immediate",
				high: "Immediate", // Map High to Immediate
				"short-term": "Short-term",
				"short term": "Short-term",
				medium: "Short-term", // Map Medium to Short-term
				moderate: "Short-term",
				"long-term": "Long-term",
				"long term": "Long-term",
				low: "Long-term",
			};

			const normalized = (priority || "Short-term").toLowerCase();
			return priorityMap[normalized] || "Short-term";
		};

		// 🆕 Helper function to map impact
		const mapImpact = (impact) => {
			const impactMap = {
				high: "High",
				significant: "High",
				major: "High",
				medium: "Medium",
				moderate: "Medium",
				average: "Medium",
				low: "Low",
				minor: "Low",
				small: "Low",
			};

			const normalized = (impact || "Medium").toLowerCase();
			return impactMap[normalized] || "Medium";
		};

		const cleaned = {
			overallScore: Math.min(100, Math.max(0, analysis.overallScore || 50)),
			atsScore: Math.min(100, Math.max(0, analysis.atsScore || 50)),

			// 🔧 FIXED: Map strengths with proper impact values
			strengths: Array.isArray(analysis.strengths)
				? analysis.strengths.slice(0, 10).map((s) => ({
						category: s.category || "General",
						point: s.point || "",
						impact: mapImpact(s.impact),
				  }))
				: [],

			// 🔧 FIXED: Map weaknesses with proper severity values
			weaknesses: Array.isArray(analysis.weaknesses)
				? analysis.weaknesses.slice(0, 10).map((w) => ({
						category: w.category || "General",
						issue: w.issue || "",
						severity: mapSeverity(w.severity),
						suggestion: w.suggestion || "",
				  }))
				: [],

			formatting: {
				score: Math.min(100, Math.max(0, analysis.formatting?.score || 50)),
				issues: Array.isArray(analysis.formatting?.issues)
					? analysis.formatting.issues.slice(0, 5)
					: [],
				recommendations: Array.isArray(analysis.formatting?.recommendations)
					? analysis.formatting.recommendations.slice(0, 5)
					: [],
			},

			keywords: {
				found: Array.isArray(analysis.keywords?.found)
					? analysis.keywords.found.slice(0, 20)
					: [],
				missing: Array.isArray(analysis.keywords?.missing)
					? analysis.keywords.missing.slice(0, 10)
					: [],
				industryRelevant: Array.isArray(analysis.keywords?.industryRelevant)
					? analysis.keywords.industryRelevant.slice(0, 15)
					: [],
				overused: Array.isArray(analysis.keywords?.overused)
					? analysis.keywords.overused.slice(0, 5)
					: [],
				suggestions: Array.isArray(analysis.keywords?.suggestions)
					? analysis.keywords.suggestions.slice(0, 10)
					: [],
			},

			sections: {
				present: Array.isArray(analysis.sections?.present)
					? analysis.sections.present
					: [],
				missing: Array.isArray(analysis.sections?.missing)
					? analysis.sections.missing
					: [],
				order: Array.isArray(analysis.sections?.order)
					? analysis.sections.order
					: [],
				recommendations: Array.isArray(analysis.sections?.recommendations)
					? analysis.sections.recommendations.slice(0, 5)
					: [],
			},

			// 🔧 FIXED: Map improvement roadmap with proper priority values
			improvementRoadmap: Array.isArray(analysis.improvementRoadmap)
				? analysis.improvementRoadmap.slice(0, 10).map((item) => ({
						priority: mapPriority(item.priority),
						action: item.action || "",
						expectedImpact: item.expectedImpact || "",
						timeRequired: item.timeRequired || "",
				  }))
				: [],

			industrySpecific: {
				industry: analysis.industrySpecific?.industry || "General",
				relevanceScore: Math.min(
					100,
					Math.max(0, analysis.industrySpecific?.relevanceScore || 0)
				),
				recommendations: Array.isArray(
					analysis.industrySpecific?.recommendations
				)
					? analysis.industrySpecific.recommendations
					: [],
				competitorsKeywords: Array.isArray(
					analysis.industrySpecific?.competitorsKeywords
				)
					? analysis.industrySpecific.competitorsKeywords
					: [],
			},

			summary: {
				brief: analysis.summary?.brief || "",
				topThreeStrengths: Array.isArray(analysis.summary?.topThreeStrengths)
					? analysis.summary.topThreeStrengths.slice(0, 3)
					: [],
				topThreeImprovements: Array.isArray(
					analysis.summary?.topThreeImprovements
				)
					? analysis.summary.topThreeImprovements.slice(0, 3)
					: [],
				estimatedImprovementTime:
					analysis.summary?.estimatedImprovementTime || "Unknown",
			},
		};

		return cleaned;
	}

	getDefaultAnalysis() {
		return {
			overallScore: 0,
			atsScore: 0,
			strengths: [],
			weaknesses: [],
			formatting: {
				score: 0,
				issues: ["Unable to analyze formatting"],
				recommendations: ["Please try uploading again"],
			},
			keywords: {
				found: [],
				missing: [],
				industryRelevant: [],
				overused: [],
				suggestions: [],
			},
			sections: {
				present: [],
				missing: [],
				order: [],
				recommendations: [],
			},
			improvementRoadmap: [],
			industrySpecific: {
				industry: "Unknown",
				relevanceScore: 0,
				recommendations: [],
				competitorsKeywords: [],
			},
			summary: {
				brief: "Analysis could not be completed. Please try again.",
				topThreeStrengths: [],
				topThreeImprovements: [],
				estimatedImprovementTime: "Unknown",
			},
		};
	}

	async processCV(file, userId, targetRole = null, experienceLevel = null) {
		const startTime = Date.now();
		let cvReview = null;

		try {
			if (!file || !file.buffer) {
				throw new Error("Invalid file");
			}

			if (file.mimetype !== "application/pdf") {
				throw new Error("Only PDF files are allowed");
			}

			const maxSize = parseInt(process.env.MAX_CV_SIZE_MB || 5) * 1024 * 1024;
			if (file.size > maxSize) {
				throw new Error(
					`File size exceeds ${process.env.MAX_CV_SIZE_MB || 5}MB limit`
				);
			}

			const fileHash = this.generateFileHash(file.buffer);

			// const existingReview = await CVReview.findOne({
			// 	user: userId,
			// 	fileHash,
			// 	status: "completed",
			// });

			// if (existingReview) {
			// 	console.log("✅ Returning cached CV review");
			// 	return existingReview;
			// }

			console.log("📄 Extracting text from PDF...");
			const pdfData = await this.extractTextFromPDF(file.buffer);

			if (!pdfData.text || pdfData.text.trim().length < 100) {
				throw new Error(
					"CV appears to be empty or too short. Please ensure the PDF contains text."
				);
			}

			console.log(
				`✅ Extracted ${pdfData.text.length} characters from ${pdfData.pages} page(s)`
			);

			const encryptedData = this.encryptFile(file.buffer);
			const fileId = uuidv4();
			const encryptedPath = path.join(
				this.storagePath,
				"encrypted",
				`${fileId}.enc`
			);
			await fs.writeFile(encryptedPath, encryptedData);

			cvReview = await CVReview.create({
				user: userId,
				fileName: file.originalname,
				fileSize: file.size,
				filePath: fileId,
				encryptedPath,
				fileHash,
				extractedText: pdfData.text,
				status: "processing",
				metadata: {
					targetRole,
					experienceLevel,
					language: this.detectLanguage(pdfData.text),
					pageCount: pdfData.pages,
					aiModel: this.modelName, // 🔧 FIXED: Use actual model name
				},
			});

			console.log("🤖 Analyzing CV with AI...");

			const analysis = await this.analyzeWithGemini(
				pdfData.text,
				targetRole,
				experienceLevel
			);

			cvReview.analysis = analysis;
			cvReview.status = "completed";
			cvReview.metadata.processingTime = Date.now() - startTime;

			const previousVersion = await CVReview.findOne({
				user: userId,
				_id: {$ne: cvReview._id},
				status: "completed",
			}).sort("-createdAt");

			if (previousVersion) {
				cvReview.previousVersion = previousVersion._id;
				cvReview.version = (previousVersion.version || 1) + 1;
			}

			await cvReview.save();

			console.log(
				`✅ CV analysis completed in ${(Date.now() - startTime) / 1000}s`
			);

			const reviewResponse = cvReview.toObject();
			delete reviewResponse.extractedText;

			return reviewResponse;
		} catch (error) {
			console.error("❌ CV processing error:", error);

			if (cvReview) {
				cvReview.status = "failed";
				cvReview.error = {
					message: error.message,
					code: error.code || "PROCESSING_ERROR",
					timestamp: new Date(),
				};
				await cvReview.save();
			}

			throw error;
		}
	}

	detectLanguage(text) {
		const englishWords = ["the", "and", "is", "in", "to", "of", "a", "for"];
		const textLower = text.toLowerCase();
		const englishCount = englishWords.filter((word) =>
			textLower.includes(` ${word} `)
		).length;

		return englishCount >= 4 ? "English" : "Unknown";
	}

	async compareVersions(userId, currentId, previousId) {
		const [current, previous] = await Promise.all([
			CVReview.findOne({_id: currentId, user: userId}),
			CVReview.findOne({_id: previousId, user: userId}),
		]);

		if (!current || !previous) {
			throw new Error("Reviews not found");
		}

		const comparison = {
			scoreImprovement:
				current.analysis.overallScore - previous.analysis.overallScore,
			atsScoreImprovement:
				current.analysis.atsScore - previous.analysis.atsScore,
			newStrengths: current.analysis.strengths.filter(
				(s) => !previous.analysis.strengths.find((ps) => ps.point === s.point)
			),
			resolvedWeaknesses: previous.analysis.weaknesses.filter(
				(w) => !current.analysis.weaknesses.find((cw) => cw.issue === w.issue)
			),
			persistentWeaknesses: current.analysis.weaknesses.filter((w) =>
				previous.analysis.weaknesses.find((pw) => pw.issue === w.issue)
			),
			keywordImprovement: {
				added: current.analysis.keywords.found.filter(
					(k) => !previous.analysis.keywords.found.includes(k)
				),
				removed: previous.analysis.keywords.found.filter(
					(k) => !current.analysis.keywords.found.includes(k)
				),
			},
		};

		return comparison;
	}

	async generatePDFReport(reviewId, userId) {
		const review = await CVReview.findOne({_id: reviewId, user: userId});

		if (!review) {
			throw new Error("Review not found");
		}

		return {
			title: "CV Analysis Report",
			date: review.createdAt,
			fileName: review.fileName,
			analysis: review.analysis,
			recommendations: review.analysis.improvementRoadmap,
		};
	}
}

module.exports = new CVReviewService();
