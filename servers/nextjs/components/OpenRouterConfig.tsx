"use client";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";
import { Switch } from "./ui/switch";
import { LLMConfig } from "@/types/llm_config";
import { getApiErrorMessage, getApiUrl } from "@/utils/api";

interface OpenRouterConfigProps {
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterBaseUrl?: string;
  webGrounding?: boolean;
  onInputChange: (value: string | boolean, field: string) => void;
  llmConfig: LLMConfig;
}

const POPULAR_OPENROUTER_MODELS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-haiku",
  "deepseek/deepseek-chat",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "mistralai/mistral-large-2411",
];

export default function OpenRouterConfig({
  openrouterApiKey,
  openrouterModel,
  openrouterBaseUrl,
  webGrounding,
  onInputChange,
  llmConfig,
}: OpenRouterConfigProps) {
  const [openModelSelect, setOpenModelSelect] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>(POPULAR_OPENROUTER_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsChecked, setModelsChecked] = useState(false);
  const [customModelInput, setCustomModelInput] = useState("");
  const isImageGenerationDisabled = llmConfig?.DISABLE_IMAGE_GENERATION ?? false;

  const defaultUrl = "https://openrouter.ai/api/v1";

  const onApiKeyChange = (value: string) => {
    onInputChange(value, "openrouter_api_key");
  };

  const fetchAvailableModels = async () => {
    if (!openrouterApiKey) return;

    setModelsLoading(true);
    try {
      const response = await fetch(getApiUrl("/api/v1/ppt/openrouter/models/available"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_url: openrouterBaseUrl || defaultUrl,
          api_key: openrouterApiKey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setAvailableModels(data);
          setModelsChecked(true);
          if (!openrouterModel) {
            onInputChange("openai/gpt-4o", "openrouter_model");
          }
          notify.success("Models loaded", `Found ${data.length} models on OpenRouter.`);
        } else {
          setAvailableModels(POPULAR_OPENROUTER_MODELS);
          setModelsChecked(true);
        }
      } else {
        const message = await getApiErrorMessage(
          response,
          "The server could not list OpenRouter models. Check your API key and try again."
        );
        console.error("Failed to fetch OpenRouter models");
        notify.error("Could not load models", message);
        setModelsChecked(true);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      notify.error(
        "Could not load models",
        "Failed to contact OpenRouter API. You can still select or type a model manually."
      );
      setModelsChecked(true);
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key & Model Selection */}
      <div className="mb-4 flex items-center justify-between bg-white p-10 rounded-[12px]">
        <div>
          <h3 className="text-xl font-normal text-[#191919]">OpenRouter API Key</h3>
          <p className="mt-2 text-sm max-w-[205px] text-gray-500">
            Access hundreds of models with a single unified OpenRouter key. Stored locally.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-[275px]">
            <div className="flex flex-col justify-start gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenRouter Key
              </label>
              <input
                type="password"
                value={openrouterApiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="sk-or-v1-..."
              />
            </div>

            <button
              onClick={fetchAvailableModels}
              disabled={modelsLoading || !openrouterApiKey}
              className={`mt-4 py-2.5 bg-[#F7F6F9] px-3.5 rounded-[48px] text-xs font-semibold text-[#101323] transition-all duration-200 border ${
                modelsLoading || !openrouterApiKey
                  ? "border-gray-300 cursor-not-allowed text-gray-500"
                  : "border-[#EDEEEF] text-blue-600 hover:bg-[#E8F0FF]/90 focus:ring-2 focus:ring-blue-500/20"
              }`}
            >
              {modelsLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking for models...
                </span>
              ) : (
                "Check available models"
              )}
            </button>
          </div>

          <div className="w-[295px]">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select OpenRouter Model
            </label>
            <div className="w-full">
              <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openModelSelect}
                    className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                  >
                    <div className="flex gap-3 items-center truncate">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {openrouterModel || "Select or enter a model"}
                      </span>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-gray-500 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 z-[100]"
                  align="start"
                  style={{ width: "320px" }}
                >
                  <Command>
                    <CommandInput
                      placeholder="Search or enter model..."
                      value={customModelInput}
                      onValueChange={setCustomModelInput}
                    />
                    <CommandList className="max-h-60 overflow-y-auto">
                      <CommandEmpty>
                        <div className="p-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">No matching model found.</p>
                          {customModelInput.trim() && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                onInputChange(customModelInput.trim(), "openrouter_model");
                                setOpenModelSelect(false);
                              }}
                            >
                              Use &ldquo;{customModelInput.trim()}&rdquo;
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup heading="Available Models">
                        {availableModels.map((model, index) => (
                          <CommandItem
                            key={index}
                            value={model}
                            onSelect={(value) => {
                              onInputChange(value, "openrouter_model");
                              setOpenModelSelect(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                openrouterModel === model ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {model}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Model Controls */}
      <div className="bg-white flex justify-between items-center p-10 rounded-[12px]">
        <div>
          <h4 className="text-xl font-normal text-[#191919]">Model Controls</h4>
          <p className="mt-2 text-sm max-w-[205px] text-gray-500">
            Configure web access, image generation, and advanced AI features.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[275px]">
            <div className="flex items-center mb-4 gap-2.5">
              <Switch
                checked={!!webGrounding}
                onCheckedChange={(checked) => onInputChange(checked, "web_grounding")}
              />
              <label className="text-sm font-medium text-gray-700">
                Enable Web Grounding
              </label>
            </div>
            <div className="flex items-center mb-4 gap-2.5">
              <Switch
                checked={!!isImageGenerationDisabled}
                onCheckedChange={(checked) =>
                  onInputChange(checked, "disable_image_generation")
                }
              />
              <label className="text-sm font-medium text-gray-700">
                Disable Image Generation
              </label>
            </div>
          </div>
          <div className="w-[295px]"></div>
        </div>
      </div>
    </div>
  );
}
