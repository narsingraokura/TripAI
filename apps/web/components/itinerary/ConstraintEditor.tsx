"use client"

import { useState } from "react"
import type { Constraint, ConstraintType } from "@/types/itinerary"
import ConstraintBadge from "./ConstraintBadge"
import { cn } from "@/lib/utils"

const MAX_CONSTRAINTS = 10

const TYPES_WITH_VALUE: ConstraintType[] = ["budget", "dates"]

const TYPE_LABELS: Record<ConstraintType, string> = {
  budget: "Budget",
  dates: "Dates",
  pace: "Pace",
  dietary: "Dietary",
  accessibility: "Accessibility",
  preference: "Preference",
}

type ConstraintEditorProps = {
  constraints: Constraint[]
  onConstraintsChange: (constraints: Constraint[]) => void
}

export default function ConstraintEditor({
  constraints,
  onConstraintsChange,
}: ConstraintEditorProps) {
  const [type, setType] = useState<ConstraintType | "">("")
  const [description, setDescription] = useState("")
  const [value, setValue] = useState("")

  const atMax = constraints.length >= MAX_CONSTRAINTS
  const showValueInput = type !== "" && TYPES_WITH_VALUE.includes(type as ConstraintType)

  function handleDelete(id: string) {
    onConstraintsChange(constraints.filter((c) => c.id !== id))
  }

  function handleAdd() {
    if (!type || !description.trim() || atMax) return
    const newConstraint: Constraint = {
      id: `constraint-${Date.now()}`,
      type: type as ConstraintType,
      description: description.trim(),
      value: value.trim() || undefined,
      status: "ok",
    }
    onConstraintsChange([...constraints, newConstraint])
    setType("")
    setDescription("")
    setValue("")
  }

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Constraints</p>
        <span className="text-xs text-slate-400">
          {constraints.length} / {MAX_CONSTRAINTS}
        </span>
      </div>

      {/* Existing constraints */}
      {constraints.length > 0 && (
        <div className="space-y-2">
          {constraints.map((c) => (
            <ConstraintBadge key={c.id} constraint={c} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="rounded-md border border-slate-200 p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">Add constraint</p>

        <div>
          <label
            htmlFor="constraint-type"
            className="block text-xs text-slate-500 mb-1"
          >
            Type
          </label>
          <select
            id="constraint-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ConstraintType | "")
              setValue("")
            }}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Select type…</option>
            {(Object.entries(TYPE_LABELS) as [ConstraintType, string][]).map(
              ([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="constraint-description"
            className="block text-xs text-slate-500 mb-1"
          >
            Description
          </label>
          <input
            id="constraint-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the constraint…"
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {showValueInput && (
          <div>
            <label
              htmlFor="constraint-value"
              className="block text-xs text-slate-500 mb-1"
            >
              Value
            </label>
            <input
              id="constraint-value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. $3000, Jun 20"
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={atMax || !type || !description.trim()}
          aria-label="Add constraint"
          className={cn(
            "w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white",
            "hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          Add constraint
        </button>
      </div>
    </div>
  )
}
