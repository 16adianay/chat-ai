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

  async function getAIResponseRecursive(messages, signal) {
    return getAIResponse(messages, signal).catch(async (error) => {
      if (!error.message.includes("Connection error")) {
        return Promise.reject(error);
      }

      DevExpress.ui.notify({
        message:
          "Our demo AI service reached a temporary request limit. Retrying in 30 seconds.",
        width: "auto",
        type: "error",
        displayTime: 5000,
      });

      await new Promise((resolve) => setTimeout(resolve, 30000));

      return getAIResponseRecursive(messages, signal);
    });
  }

  return new DevExpress.aiIntegration.AIIntegration({
    sendRequest({ prompt }) {
      const isValidRequest = JSON.stringify(prompt.user).length < 5000;
      if (!isValidRequest) {
        return {
          promise: Promise.reject(
            new ChatCommandError(
              "❌ That message is too long for me to process. Please shorten it and try again.",
            ),
          ),
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
