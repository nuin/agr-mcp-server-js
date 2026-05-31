import defaults from "./defaults.json" with { type: "json" };

export interface AllianceConfig {
  agrApiUrl: string;
  allianceMineUrl: string;
}

export function loadConfig(overrides: Partial<AllianceConfig> = {}): AllianceConfig {
  return {
    agrApiUrl:
      overrides.agrApiUrl ?? process.env.AGR_API_URL ?? defaults.agrApiUrl,
    allianceMineUrl:
      overrides.allianceMineUrl ??
      process.env.ALLIANCEMINE_URL ??
      defaults.allianceMineUrl,
  };
}
