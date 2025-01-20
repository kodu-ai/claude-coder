# Provider Implementation Guide

## Architecture Overview
Providers consist of:
- **Configuration**: Defines models/endpoints (in `config/`)
- **Class Implementation**: Handles API calls (extends `ApiHandler`)
- **Type Definitions**: Interfaces/Schemas (in `types.ts`)
- **Frontend Integration**: Automatic UI registration

## Creating a New Provider

### 1. Configuration File
Create new config in `config/` directory:
```ts
// config/example-provider.ts
import { ProviderConfig } from "../types"

export const exampleConfig = {
  id: "example" as const,
  name: "Example Provider",
  baseUrl: "https://api.example.com/v1",
  models: [
    {
      id: "example-model",
      name: "Example Model",
      contextWindow: 128000,
      maxTokens: 4096,
      supportsImages: false,
      inputPrice: 0.5,
      outputPrice: 1.5,
      provider: "example"
    }
  ],
  requiredFields: ["apiKey"]
}
```

### 2. Register Configuration
Add to `config/index.ts`:
```ts
import { exampleConfig } from "./example-provider"

export const providerConfigs = {
  ...existingConfigs,
  [PROVIDER_IDS.EXAMPLE]: exampleConfig
}
```

### 3. Implement Provider Class
Extend `CustomApiHandler` in `custom-provider.ts`:
```ts
case PROVIDER_IDS.EXAMPLE:
  if (!settings.apiKey) throw error
  return createExampleSDK({
    apiKey: settings.apiKey
  }).languageModel(modelId)
```

### 4. Update Type Definitions
Add to `types.ts`:
```ts
export interface ExampleSettings extends BaseProviderSettings {
  providerId: "example"
  apiKey: string
  baseUrl?: string
}

// Add to ProviderSettings union
export type ProviderSettings = ... | ExampleSettings
```

## Frontend Integration
Models automatically appear in UI when:
1. Added to providerConfigs
2. ModelInfo.provider matches provider ID
3. Type definitions are properly extended

## Validation Requirements
- Implement Zod schema for custom providers
- Handle API key validation
- Throw `CustomProviderError` for provider-specific issues

## Example Workflow (Adding Mistral)
1. Create `config/mistral.ts`
2. Add to providerConfigs
3. Implement Mistral handler in custom-provider.ts 
4. Extend types.ts with MistralSettings
5. Models appear automatically in model picker

## Testing Guidelines
1. Verify provider appears in settings
2. Test API key validation
3. Check model streaming functionality
4. Verify cost calculations
5. Confirm UI displays all model metadata