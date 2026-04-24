"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import type { Goal } from "@/types/itinerary"
import { PRESET_GOALS } from "@/types/itinerary"
import GoalChip from "./GoalChip"
import { cn } from "@/lib/utils"

type GoalSelectorProps = {
  selectedGoals: Goal[]
  onGoalsChange: (goals: Goal[]) => void
}

function presetId(label: string): string {
  return `preset-${label}`
}

export default function GoalSelector({ selectedGoals, onGoalsChange }: GoalSelectorProps) {
  const [customInput, setCustomInput] = useState("")

  const customGoalsCount = selectedGoals.filter((g) => !g.isPreset).length
  const atCustomMax = customGoalsCount >= 3

  function isPresetSelected(label: string): boolean {
    return selectedGoals.some((g) => g.isPreset && g.label === label)
  }

  function handlePresetToggle(label: string) {
    if (isPresetSelected(label)) {
      onGoalsChange(selectedGoals.filter((g) => !(g.isPreset && g.label === label)))
    } else {
      onGoalsChange([
        ...selectedGoals,
        { id: presetId(label), label, isPreset: true },
      ])
    }
  }

  function handleAddCustom() {
    const trimmed = customInput.trim()
    if (!trimmed || atCustomMax) return
    const newGoal: Goal = {
      id: `custom-${Date.now()}`,
      label: trimmed,
      isPreset: false,
    }
    onGoalsChange([...selectedGoals, newGoal])
    setCustomInput("")
  }

  function handleRemoveGoal(id: string) {
    onGoalsChange(selectedGoals.filter((g) => g.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Preset grid */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Choose from presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_GOALS.map((label) => (
            <GoalChip
              key={label}
              label={label}
              selected={isPresetSelected(label)}
              onClick={() => handlePresetToggle(label)}
            />
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">
          Custom goals
          <span className="ml-1 text-xs font-normal text-slate-400">
            ({customGoalsCount}/3)
          </span>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCustom()
            }}
            placeholder="Add a custom goal…"
            maxLength={120}
            disabled={atCustomMax}
            className={cn(
              "flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-slate-400",
              atCustomMax && "cursor-not-allowed opacity-50",
            )}
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={atCustomMax || !customInput.trim()}
            aria-label="Add goal"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-slate-200",
              "px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Your goals */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Your goals</p>
        {selectedGoals.length === 0 ? (
          <p className="text-sm text-slate-400">Select at least 1 goal</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedGoals.map((goal) => (
              <GoalChip
                key={goal.id}
                label={goal.label}
                selected
                isCustom={!goal.isPreset}
                onRemove={() => handleRemoveGoal(goal.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
