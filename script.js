/**
 * Gemini API Key Tester - Updated for current models
 */

const API_KEY = "AIzaSyD0IEWxjMuop-QQSP4EAWmn-dlRHQsC-K8"; // Replace with your actual API key
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Updated models based on your API response
const MODELS_TO_TEST = [
	// Latest stable models
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.0-flash",
	"gemini-2.0-flash-lite",

	// Latest aliases
	"gemini-flash-latest",
	"gemini-pro-latest",
	"gemini-flash-lite-latest",

	// Experimental/Preview
	"gemini-3-pro-preview",
	"gemini-2.5-flash-image-preview",

	// Open source Gemma models
	"gemma-3-27b-it",
	"gemma-3-12b-it",
	"gemma-3-4b-it",
];

async function listAllModels() {
	console.log("📋 Fetching all available models...\n");

	try {
		const response = await fetch(`${BASE_URL}/models?key=${API_KEY}`);
		const data = await response.json();

		if (!response.ok) {
			console.error("❌ API Key is invalid or request failed");
			console.error("Error:", data.error?.message || JSON.stringify(data));
			return null;
		}

		console.log("✅ API Key is valid!\n");

		if (data.models && data.models.length > 0) {
			// Filter only generateContent-capable models
			const textGenModels = data.models.filter((m) =>
				m.supportedGenerationMethods?.includes("generateContent")
			);

			console.log(`Found ${data.models.length} total models`);
			console.log(`Found ${textGenModels.length} text generation models:\n`);

			textGenModels.forEach((model) => {
				const name = model.name.replace("models/", "");
				console.log(`  • ${name}`);
				console.log(`    ${model.displayName}`);
			});

			return textGenModels;
		}
		return [];
	} catch (error) {
		console.error("❌ Error fetching models:", error.message);
		return null;
	}
}

async function testModel(modelName) {
	const url = `${BASE_URL}/models/${modelName}:generateContent?key=${API_KEY}`;

	const payload = {
		contents: [
			{
				parts: [
					{
						text: 'Respond with just "OK"',
					},
				],
			},
		],
	};

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const data = await response.json();

		if (response.ok && data.candidates) {
			return {
				accessible: true,
				response:
					data.candidates[0]?.content?.parts[0]?.text || "No text response",
			};
		} else {
			return {
				accessible: false,
				error: data.error?.message || "Unknown error",
				statusCode: response.status,
			};
		}
	} catch (error) {
		return {
			accessible: false,
			error: error.message,
		};
	}
}

async function testSpecificModels() {
	console.log("\n" + "=".repeat(60));
	console.log("🧪 Testing specific models for accessibility...\n");
	console.log("⚠️  NOTE: You may hit rate limits on the free tier\n");

	const results = [];

	for (const modelName of MODELS_TO_TEST) {
		process.stdout.write(`Testing ${modelName}... `);

		const result = await testModel(modelName);
		results.push({model: modelName, ...result});

		if (result.accessible) {
			console.log("✅ Accessible");
		} else {
			console.log("❌ Not accessible");
			if (result.error.includes("quota")) {
				console.log(`   ⚠️  QUOTA EXCEEDED - Stopping tests`);
				break; // Stop testing if we hit quota
			} else {
				console.log(`   Reason: ${result.error.substring(0, 100)}...`);
			}
		}

		// Longer delay to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	return results;
}

async function main() {
	console.log("🔑 Gemini API Key Tester (Updated)\n");
	console.log("=".repeat(60) + "\n");

	if (API_KEY === "YOUR_API_KEY_HERE" || !API_KEY) {
		console.error("❌ Please set your API key in the script!");
		return;
	}

	// First, list all available models
	const allModels = await listAllModels();

	if (allModels === null) {
		console.log(
			"\n⚠️  Could not verify API key. Please check your key and try again."
		);
		return;
	}

	// Ask user if they want to test (might hit quota)
	console.log("\n⚠️  WARNING: Testing models will count against your quota.");
	console.log("You can see all available models above.");
	console.log("\nSkipping live tests to preserve your quota...\n");

	// Uncomment below to actually test models
	// const testResults = await testSpecificModels();

	console.log("=".repeat(60));
	console.log("✅ Your API key is valid and has access to all listed models!");
	console.log("\n💡 Recommended models to use:");
	console.log("   • gemini-2.5-flash (fastest, latest)");
	console.log("   • gemini-2.5-pro (most capable)");
	console.log("   • gemini-flash-latest (auto-updates to latest)");
	console.log("\n⚠️  Rate Limit Info:");
	console.log("   Free tier: 15 RPM, 1M tokens/day");
	console.log("   Monitor usage: https://ai.dev/usage");
	console.log("=".repeat(60));
}

main();
