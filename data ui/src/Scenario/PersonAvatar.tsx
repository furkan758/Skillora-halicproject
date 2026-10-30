import Avatar from "../otherComponents/Avatar";
export default function PersonAvatar({
  person,
}: {
  person: { firstName: string; lastName: string };
}) {
  return <Avatar employee={person} size="tiny" />;
}
