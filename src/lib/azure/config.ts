
import { AzureStorageConfig, AzureAIConfig, AzureCosmosConfig } from "../types";

// Azure Storage configuration
export const AZURE_STORAGE: AzureStorageConfig = {
  accountName: "yscuvideostorage",
  accountKey: "",
  containerName: "videos"
};

// SAS token for Azure Blob Storage
export const AZURE_SAS_TOKEN = "sp=racwdli&st=2025-03-13T03:27:16Z&se=2025-12-30T11:27:16Z&spr=https&sv=2022-11-02&sr=c&sig=JrIXtTQa8m%2FSAKu4itjchssjJ01w5EownB37xx2NVos%3D";

// Azure AI Content Understanding configuration
export const AZURE_AI: AzureAIConfig = {
  endpoint: "https://ai-yshubaicontentintel279307737903.cognitiveservices.azure.com/",
  apiKey: "cca7a02484284215a9daffab8cf0e701",
  region: "eastus" // Assumed region, update if different
};

export const ANALYZER_ID = "TanscriptAnalyzer";
export const API_VERSION = "2024-12-01-preview";

// Azure Cosmos DB configuration
export const AZURE_COSMOS: AzureCosmosConfig = {
  endpoint: "https://videocucosmosdb.documents.azure.com:443/",
  key: "unakRlhfk1vecTKrVJ2ZBQH0OLWHlQe0DKQbfacp7dUZrv810lYI9TT14zWkyA7yPpKUHfuhBM0lACDbFk94aQ==",
  databaseName: "Videos",
  containerName: "Transcripts"
};

// In-memory storage for videos and transcripts
export let mockVideos: Video[] = [];
export let mockTranscripts: Transcript[] = [];

// Import Video and Transcript types to avoid circular dependencies
import { Video, Transcript } from "../types";
