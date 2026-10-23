export function createBarangayDetailsActions(context) {
  const {
    barangays,
    selectedBarangay,
    barangayDetailsDraft,
    setBarangayDetailsDraft,
    confirmationContactDraft,
    setConfirmationContactDraft,
    setShowBarangayDetails,
    setShowConfirmationContact,
    setNotice,
    commitBarangay,
  } = context;

  function openDetailsEditor() {
    if (!selectedBarangay) return;
    setBarangayDetailsDraft({
      name: selectedBarangay.name,
      puroks: selectedBarangay.puroks.join("\n"),
      notes: selectedBarangay.notes,
    });
    setShowBarangayDetails(true);
  }

  function saveBarangayDetails(event) {
    event.preventDefault();
    if (!selectedBarangay) return;
    const name = barangayDetailsDraft.name.trim();
    if (!name) {
      setNotice({ kind: "error", text: "Enter a barangay name before saving." });
      return;
    }
    const normalizedName = name.toLocaleLowerCase("en-US");
    const duplicateName = barangays.some((item) => item.id !== selectedBarangay.id &&
      item.name.trim().toLocaleLowerCase("en-US") === normalizedName);
    if (duplicateName) {
      setNotice({ kind: "error", text: "Another barangay already uses that name." });
      return;
    }
    const puroks = [...new Set(barangayDetailsDraft.puroks.split(/[\n,]/).map((name) => name.trim()).filter(Boolean))];
    const notes = barangayDetailsDraft.notes.trim();
    const changed = name !== selectedBarangay.name ||
      JSON.stringify(puroks) !== JSON.stringify(selectedBarangay.puroks) ||
      notes !== selectedBarangay.notes;
    if (changed) {
      commitBarangay(selectedBarangay.id, (current) => ({ ...current, name, puroks, notes }), {
        action: "Updated barangay details",
        itemType: "Barangay details",
        itemName: name,
        barangayName: name,
        details: `${puroks.length} purok${puroks.length === 1 ? "" : "s"} recorded`,
      });
    }
    setShowBarangayDetails(false);
  }

  function openConfirmationContactEditor() {
    if (!selectedBarangay) return;
    const contact = selectedBarangay.confirmationContact ?? {};
    setConfirmationContactDraft({
      name: contact.name ?? "",
      position: contact.position ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    });
    setShowConfirmationContact(true);
  }

  function saveConfirmationContact(event) {
    event.preventDefault();
    if (!selectedBarangay) return;
    const contact = Object.fromEntries(Object.entries(confirmationContactDraft).map(([key, value]) => [key, value.trim()]));
    if (!contact.name) {
      setNotice({ kind: "error", text: "Enter the name of the official you spoke with." });
      return;
    }

    if (!selectedBarangay.confirmed) {
      setConfirmed(true, contact);
    } else {
      const currentContact = selectedBarangay.confirmationContact ?? {};
      const changed = Object.keys(contact).some((key) => (currentContact[key] ?? "") !== contact[key]);
      if (changed) {
        commitBarangay(selectedBarangay.id, (current) => ({ ...current, confirmationContact: contact }), {
          action: "Updated confirmation contact",
          itemType: "Barangay confirmation",
          itemName: selectedBarangay.name,
          details: `Contact details updated for ${contact.name}${contact.position ? `, ${contact.position}` : ""}`,
        });
      }
    }
    setShowConfirmationContact(false);
  }

  function setConfirmed(confirmed, confirmationContact = selectedBarangay?.confirmationContact ?? null) {
    if (!selectedBarangay || confirmed === selectedBarangay.confirmed) return;
    commitBarangay(selectedBarangay.id, (current) => ({
      ...current,
      confirmed,
      ...(confirmed ? { confirmationContact } : {}),
    }), {
      action: confirmed ? "Confirmed barangay information" : "Reopened barangay review",
      itemType: "Barangay confirmation",
      itemName: selectedBarangay.name,
      details: confirmed
        ? `Confirmed by ${confirmationContact?.name ?? "an official"}${confirmationContact?.position ? `, ${confirmationContact.position}` : ""}`
        : "Marked unconfirmed",
    });
  }

  return { openDetailsEditor, saveBarangayDetails, openConfirmationContactEditor, saveConfirmationContact, setConfirmed };
}
