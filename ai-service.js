function sanitizeSmartPasteResponse(rawText, fieldNames) {
  if (typeof rawText !== "string" || fieldNames.length === 0) {
    return rawText;
  }

  const escapedNames = fieldNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const fieldMarker = new RegExp(`(?:${escapedNames.join("|")}):::`, "g");
  const matches = [...rawText.matchAll(fieldMarker)];
  if (matches.length === 0) {
    return rawText;
  }

  const pairs = matches.map((match, index) => {
    const name = match[0].slice(0, -3);
    const valueStart = match.index + match[0].length;
    const valueEnd =
      index + 1 < matches.length ? matches[index + 1].index : rawText.length;

    const value = rawText
      .slice(valueStart, valueEnd)
      .replace(/;;;\s*$/, "")
      .trim();

    return `${name}:::${value}`;
  });

  return pairs.join(";;;");
}

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
temperature: 0,
    };

    const response = await aiService.chat.completions.create(params, {
      signal,
    });

    return response.choices[0].message?.content;
  }

  async function getAIResponseRecursive(messages, signal) {
    return getAIResponse(messages, signal).catch(async (error) => {
      if (!error.message.includes("Connection error")) {
        throw error;
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
    sendRequest({ prompt, data }) {
      const isValidRequest = JSON.stringify(prompt.user).length < 20000;
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
      const fieldNames = Array.isArray(data?.fields)
        ? data.fields.map((field) => field.name)
        : [];
      const promise = getAIResponseRecursive(aiPrompt, signal).then((text) =>
        fieldNames.length > 0
          ? sanitizeSmartPasteResponse(text, fieldNames)
          : text,
      );

      return {
        promise,
        abort: () => {
          controller.abort();
        },
      };
    },
  });
}
