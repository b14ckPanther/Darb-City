import type { Locale } from "@darb/core";
import { at } from "./copy";
import type { EditorLabels } from "./EditorShell";

export function editorLabels(locale: Locale): EditorLabels {
  return {
    save: at(locale, "save"),
    saved: at(locale, "saved"),
    unsaved: at(locale, "unsavedChanges"),
    allSaved: at(locale, "allSaved"),
    discard: at(locale, "discard"),
    discardConfirm: at(locale, "discardConfirm"),
    leaveConfirm: at(locale, "leaveConfirm"),
    fix: at(locale, "errorFix"),
    sections: at(locale, "sections"),
    edit: at(locale, "edit"),
    preview: at(locale, "livePreview"),
    shortcut: at(locale, "saveShortcut"),
  };
}
