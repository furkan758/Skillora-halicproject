import type { Catalog } from "../types";

export default function CatalogSkillOptions({
  folders,
  skills,
  exclude = [],
}: Catalog & { exclude?: string[] }) {
  const available = skills.filter((s) => !exclude.includes(s.name));
  return folders.map((folder) => {
    const entries = available
      .filter((s) => s.folderId === folder.id)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    return (
      entries.length > 0 && (
        <optgroup label={folder.name} key={folder.id}>
          {entries.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )
    );
  });
}
