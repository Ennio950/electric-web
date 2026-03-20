import React from "react";

const UNIT_GROUPS: Record<string, string[]> = {
  length: ["mm", "cm", "m", "in", "ft"],
  area: ["mm2", "cm2", "m2", "in2", "ft2"],
  volume: ["mm3", "cm3", "m3", "in3", "ft3", "L"],
  mass: ["g", "kg", "lb"],
  generic: ["unit", "pcs", "lot"]
};

const ALL_UNITS = Object.values(UNIT_GROUPS).flat();

interface UnitPickerProps {
  value?: string;
  onChange: (value: string) => void;
  id?: string;
  allowEmpty?: boolean;
}

export default function UnitPicker({ value = "", onChange, id, allowEmpty = true }: UnitPickerProps) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      {allowEmpty && <option value="">(no unit)</option>}
      {ALL_UNITS.map((unit) => (
        <option key={unit} value={unit}>{unit}</option>
      ))}
    </select>
  );
}

