export type FlagType = "boolean" | "string";

export type FlagDefinition = {
  name: string;
  aliases?: string[];
  type: FlagType;
  description: string;
  required?: boolean;
  defaultValue?: string | boolean;
  choices?: string[];
  hidden?: boolean;
};

export type ArgumentDefinition = {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
};

export type ParsedValues = Record<string, string | boolean | undefined>;

export type CommandContext = {
  values: ParsedValues;
  positionals: string[];
};

export type CommandDefinition = {
  name: string;
  aliases?: string[];
  summary: string;
  description?: string;
  flags?: FlagDefinition[];
  arguments?: ArgumentDefinition[];
  examples?: string[];
  subcommands?: CommandDefinition[];
  hidden?: boolean;
  execute?: (context: CommandContext) => Promise<void>;
};
