import type { Catalog } from "../types";
export default function CatalogSkillOptions({
  folders,
  skills,
  exclude = [],
}: Catalog & { exclude?: number[] }) {
  return folders.map((folder) => {
    const entries = skills.filter(
      (s) => s.folderId === folder.id && !exclude.includes(s.id),
    );
    return (
      entries.length > 0 && (
        <optgroup label={folder.name} key={folder.id}>
          {entries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )
    );
  });
}
