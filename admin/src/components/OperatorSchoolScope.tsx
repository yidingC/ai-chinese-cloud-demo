import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import type { PlatformState, School } from "../domain/types";
import { Select } from "./ui";

export function useOperatorSchoolScope(state: PlatformState) {
  const [searchParams, setSearchParams] = useSearchParams();
  const schools = useMemo(
    () => state.schools.filter((school) => school.status === "active"),
    [state.schools]
  );
  const requestedSchoolId = searchParams.get("school") ?? "";
  const selectedSchoolId = schools.some((school) => school.id === requestedSchoolId)
    ? requestedSchoolId
    : schools[0]?.id ?? "";
  const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? null;

  function selectSchool(nextSchoolId: string) {
    if (!schools.some((school) => school.id === nextSchoolId)) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("school", nextSchoolId);
    setSearchParams(nextParams, { replace: true });
  }

  return { schools, selectedSchoolId, selectedSchool, selectSchool };
}

export function OperatorSchoolSelect({
  schools,
  schoolId,
  onChange,
  className = ""
}: {
  schools: School[];
  schoolId: string;
  onChange: (schoolId: string) => void;
  className?: string;
}) {
  return (
    <div className={`student-management-school school-scope ${className}`.trim()}>
      <Building2 size={16} aria-hidden="true" />
      <Select
        aria-label="学校范围"
        className="student-management-school-select"
        value={schoolId}
        onChange={(event) => onChange(event.target.value)}
      >
        {schools.map((school) => (
          <option key={school.id} value={school.id}>{school.name}</option>
        ))}
      </Select>
    </div>
  );
}

export function SchoolScopeLabel({
  name,
  className = ""
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={`results-school-fixed ${className}`.trim()}>
      <Building2 size={16} aria-hidden="true" />
      <strong>{name}</strong>
    </span>
  );
}
