const fallbackApiKey = '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';

async function getLlmResponse(userPrompt) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY || fallbackApiKey;
    
    console.log(`[Assistant LLM Helper] Generating response for prompt: "${userPrompt}"...`);
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta/llama-3.2-11b-vision-instruct",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant inside the ARGUS autonomous web automation suite. Keep your response extremely concise, helpful, and natural (1 sentence maximum). Do not use markdown format, asterisks, or code."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 120
      })
    });

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = (data.choices?.[0]?.message?.content || '').trim();
    console.log(`[Assistant LLM Helper] Response: "${responseText}"`);
    return responseText;
  } catch (error) {
    console.error('[Assistant LLM Helper] Error querying Nvidia NIM API:', error.message);
    return "Action completed.";
  }
}

module.exports = { getLlmResponse };
