"use client";

import { useEffect, useState } from "react";
import { settingsService } from "@/services/settingsService";
import type {
  CompanySettings,
  ConfigurableOption,
  MasterRecord,
  NumberingFormat
} from "@/types/settings";

export function useSettings() {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [numberingFormats, setNumberingFormats] = useState<NumberingFormat[]>([]);
  const [configurableOptions, setConfigurableOptions] = useState<ConfigurableOption[]>([]);
  const [masters, setMasters] = useState<Record<string, MasterRecord[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [
        company,
        numbering,
        options,
        service_catalog,
        document_templates,
        standard_terms,
        payment_milestone_templates,
        expense_categories,
        project_types
      ] = await Promise.all([
        settingsService.getCompanySettings(),
        settingsService.getNumberingFormats(),
        settingsService.listConfigurableOptions(),
        settingsService.listMaster("service_catalog"),
        settingsService.listMaster("document_templates"),
        settingsService.listMaster("standard_terms"),
        settingsService.listMaster("payment_milestone_templates"),
        settingsService.listMaster("expense_categories"),
        settingsService.listMaster("project_types")
      ]);
      setCompanySettings(company);
      setNumberingFormats(numbering);
      setConfigurableOptions(options);
      setMasters({ service_catalog, document_templates, standard_terms, payment_milestone_templates, expense_categories, project_types });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load settings.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  return {
    companySettings,
    numberingFormats,
    configurableOptions,
    masters,
    isLoading,
    errorMessage,
    loadSettings,
    saveCompanySettings: settingsService.saveCompanySettings,
    saveNumberingFormat: settingsService.saveNumberingFormat,
    createConfigurableOption: settingsService.createConfigurableOption,
    createMaster: settingsService.createMaster
  };
}
