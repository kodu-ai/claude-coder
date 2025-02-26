# OpenRouter Provider for Vercel AI SDK

The [OpenRouter](https://openrouter.ai/) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs)
contains 160+ language model support for the OpenRouter chat and completion APIs.

## Setup

```bash
# For pnpm
pnpm add @openrouter/ai-sdk-provider

# For npm
npm install @openrouter/ai-sdk-provider

# For yarn
yarn add @openrouter/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `openrouter` from `@openrouter/ai-sdk-provider`:

```ts
import { openrouter } from "@openrouter/ai-sdk-provider";
```

## Example

```ts
import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const { text } = await generateText({
  model: openrouter("openai/gpt-4o"),
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});
```

## Supported models

This list is not a definitive list of models supported by OpenRouter, as it constantly changes as we add new models (and deprecate old ones) to our system.  
You can find the latest list of models supported by OpenRouter [here](https://openrouter.ai/models).

You can find the latest list of tool-supported models supported by OpenRouter [here](https://openrouter.ai/models?order=newest&supported_parameters=tools). (Note: This list may contain models that are not compatible with the AI SDK.)

## Passing Extra Body to OpenRouter

When you want to pass extra body to OpenRouter or to the upstream provider, you can do so by setting the `extraBody` property on the language model.

```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const provider = createOpenRouter({
  apiKey: "your-api-key",
  // Extra body to pass to OpenRouter
  extraBody: {
    custom_field: "custom_value",
    providers: {
      anthropic: {
        custom_field: "custom_value",
      },
    },
  },
});
const model = provider.chat("anthropic/claude-3.5-sonnet");
const response = await model.doStream({
  inputFormat: "prompt",
  mode: { type: "regular" },
  prompt: [{ role: "user", content: "Hello" }],
});
```
