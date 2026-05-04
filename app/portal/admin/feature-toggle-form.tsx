"use client";

import { useTransition, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp } from "lucide-react";
import { setCompanyFeaturesAction, setRoleFeaturesAction } from "./actions";
import { featureLabels } from "@/lib/features";
import { ALL_FEATURES } from "@/types/db";
import type { AppFeature, RoleFeatures } from "@/types/db";

// ---------------------------------------------------------------------------
// Shared toggle grid
// ---------------------------------------------------------------------------

function FeatureGrid({
  features,
  enabled,
  namePrefix,
}: {
  features: AppFeature[];
  enabled: Set<AppFeature>;
  namePrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {features.map((f) => {
        const on = enabled.has(f);
        return (
          <label
            key={f}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${
              on
                ? "bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700"
                : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
            }`}
          >
            <input
              type="checkbox"
              name={`${namePrefix}${f}`}
              defaultChecked={on}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <span
              className={`text-sm font-medium ${
                on
                  ? "text-primary-700 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {featureLabels[f]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company-wide features section
// ---------------------------------------------------------------------------

function CompanyFeaturesSection({
  companyId,
  companyName,
  enabledFeatures,
}: {
  companyId: string;
  companyName: string;
  enabledFeatures: AppFeature[] | null;
}) {
  const [isPending, startTransition] = useTransition();
  const enabled = new Set<AppFeature>(
    enabledFeatures === null ? ALL_FEATURES : enabledFeatures,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setCompanyFeaturesAction(companyId, fd);
      if (res.error) toast.error(res.error);
      else toast.success(`تم تحديث ميزات ${companyName}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FeatureGrid
        features={ALL_FEATURES}
        enabled={enabled}
        namePrefix="feature_"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "جارٍ الحفظ..." : "حفظ"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Per-role section
// ---------------------------------------------------------------------------

function RoleSection({
  companyId,
  companyName,
  role,
  roleLabel,
  availableFeatures,
  currentRoleFeatures,
}: {
  companyId: string;
  companyName: string;
  role: "company_manager" | "employee";
  roleLabel: string;
  /** Features available to this company (subset of ALL_FEATURES) */
  availableFeatures: AppFeature[];
  currentRoleFeatures: AppFeature[] | undefined;
}) {
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);

  // null override = role sees everything available to the company
  const enabled = new Set<AppFeature>(
    currentRoleFeatures ?? availableFeatures,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setRoleFeaturesAction(companyId, role, fd);
      if (res.error) toast.error(res.error);
      else toast.success(`تم تحديث صلاحيات ${roleLabel} في ${companyName}`);
    });
  }

  const hasOverride = currentRoleFeatures !== undefined;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-right"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {roleLabel}
          </span>
          {hasOverride ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
              تخصيص مفعّل
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
              كل الميزات
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded ? (
        <div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            اختر الوحدات التي يراها هذا الدور. تحديد الكل يلغي التخصيص ويعرض
            جميع ميزات الشركة.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <FeatureGrid
              features={availableFeatures}
              enabled={enabled}
              namePrefix="role_feature_"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {isPending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FeatureToggleForm({
  companyId,
  companyName,
  enabledFeatures,
  roleFeatures,
}: {
  companyId: string;
  companyName: string;
  /** null = all features on */
  enabledFeatures: AppFeature[] | null;
  /** null = no per-role overrides */
  roleFeatures: RoleFeatures | null;
}) {
  const availableFeatures: AppFeature[] =
    enabledFeatures === null ? ALL_FEATURES : enabledFeatures;

  return (
    <div className="space-y-4">
      {/* Section 1: Company-wide */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          ميزات الشركة
        </p>
        <CompanyFeaturesSection
          companyId={companyId}
          companyName={companyName}
          enabledFeatures={enabledFeatures}
        />
      </div>

      {/* Section 2 & 3: Per-role overrides */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          صلاحيات الأدوار
        </p>
        <div className="space-y-2">
          <RoleSection
            companyId={companyId}
            companyName={companyName}
            role="company_manager"
            roleLabel="مدير الشركة"
            availableFeatures={availableFeatures}
            currentRoleFeatures={roleFeatures?.company_manager}
          />
          <RoleSection
            companyId={companyId}
            companyName={companyName}
            role="employee"
            roleLabel="الموظف"
            availableFeatures={availableFeatures}
            currentRoleFeatures={roleFeatures?.employee}
          />
        </div>
      </div>
    </div>
  );
}
