"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { contactService } from "@/services/contactService";
import type { Contact, ContactFormData } from "@/types/contact";

export function useContacts(clientId?: string) {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setContacts(clientId ? await contactService.getContactsByClient(clientId) : await contactService.getContacts());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load contacts.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return contacts.filter((contact) =>
      !q ||
      [contact.full_name, contact.designation, contact.email, contact.phone, contact.whatsapp, contact.department, contact.client?.company_name]
        .some((value) => value?.toLowerCase().includes(q))
    );
  }, [contacts, searchTerm]);

  async function saveContact(data: ContactFormData, id?: string) {
    const record = id
      ? await contactService.updateContact(id, data)
      : await contactService.createContact({ ...data, created_by: user?.id ?? null });
    await loadContacts();
    return record;
  }

  async function deleteContact(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete contacts.");
    await contactService.deleteContact(id);
    setContacts((current) => current.filter((contact) => contact.id !== id));
  }

  return {
    contacts,
    filteredContacts,
    isLoading,
    errorMessage,
    searchTerm,
    setSearchTerm,
    saveContact,
    deleteContact,
    loadContacts
  };
}
