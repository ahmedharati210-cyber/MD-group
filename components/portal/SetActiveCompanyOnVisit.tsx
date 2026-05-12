"use client";

import { useEffect, useRef } from "react";
import { setPortalActiveCompanyAction } from "@/app/portal/companies/active-company-actions";

type Props = {
  companyId: string;
  /** MD Group manager: `md_admin` without super-admin flag */
  enabled: boolean;
};

/**
 * Sets the portal active-company cookie when an MD Group manager opens a company page.
 */
export function SetActiveCompanyOnVisit({ companyId, enabled }: Props) {
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;
    void setPortalActiveCompanyAction(companyId).then((res) => {
      if (res.error) {
        console.warn("[SetActiveCompanyOnVisit]", res.error);
      }
    });
  }, [companyId, enabled]);

  return null;
}
