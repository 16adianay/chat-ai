const MAX_AI_RETRIES = 3;

function createAiIntegration() {
  const aiService = new AzureOpenAI({
    dangerouslyAllowBrowser: true,
    deployment,
    endpoint,
    apiVersion,
    apiKey,
  });

  async function getAIResponse(messages, signal) {
    const params = {
      messages,
      model: deployment,
      max_completion_tokens: 1000,
      temperature: 0.7,
    };

    const response = await aiService.chat.completions.create(params, {
      signal,
    });
    const result = response.choices[0].message?.content;

    return result;
  }

  async function getAIResponseRecursive(messages, signal, retryCount = 0) {
    return getAIResponse(messages, signal).catch(async (error) => {
      if (!error.message.includes("Connection error")) {
        return Promise.reject(error);
      }

      if (retryCount >= MAX_AI_RETRIES) {
        return Promise.reject(error);
      }

      DevExpress.ui.notify({
        message:
          "Our demo AI service reached a temporary request limit. " +
          `Retrying in 30 seconds (attempt ${retryCount + 1}/${MAX_AI_RETRIES}).`,
        width: "auto",
        type: "error",
        displayTime: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 30000));

      return getAIResponseRecursive(messages, signal, retryCount + 1);
    });
  }

  return new DevExpress.aiIntegration.AIIntegration({
    sendRequest({ prompt }) {
      const isValidRequest = JSON.stringify(prompt.user).length < 5000;
      if (!isValidRequest) {
        return {
          promise: Promise.reject(new Error()),
          abort: () => {},
        };
      }
      const controller = new AbortController();
      const signal = controller.signal;

      const aiPrompt = [
        { role: "system", content: prompt.system ?? "" },
        { role: "user", content: prompt.user },
      ];
      const promise = getAIResponseRecursive(aiPrompt, signal);

      return {
        promise,
        abort: () => {
          controller.abort();
        },
      };
    },
  });
}
