import type { InteractionRoundScenario, InteractionRoundTemplate } from "../domain/types";
import { countRoundTemplatesByScenario, ROUND_TEMPLATE_SCENARIOS } from "../lib/roundTemplates";

export function InteractionRoundTemplateChips({
  templates,
  value,
  onChange
}: {
  templates: InteractionRoundTemplate[];
  value: InteractionRoundScenario | "all";
  onChange: (next: InteractionRoundScenario | "all") => void;
}) {
  const counts = countRoundTemplatesByScenario(templates);
  return (
    <div className="template-chip-row" aria-label="教学场景">
      <button className={value === "all" ? "active" : ""} onClick={() => onChange("all")}>
        全部场景<span className="template-chip-count">{templates.length}</span>
      </button>
      {ROUND_TEMPLATE_SCENARIOS.map((scenario) => (
        <button
          key={scenario.id}
          className={value === scenario.id ? "active" : ""}
          onClick={() => onChange(scenario.id)}
          disabled={!counts[scenario.id]}
          title={scenario.description}
        >
          {scenario.label}
          <span className="template-chip-count">{counts[scenario.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
