const content = `import { db } from '~/server/db';
import { users } from '~/server/db/schemas';
import { getClerkUserIdMap } from '~/server/api/services';
import UserManagement from './UserManagement';

async function getUsers() {
  const userRecords = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      status: users.status,
    })
    .from(users)
    .orderBy(users.createdAt);

  const userIds = userRecords.map((user) => user.id);
  const usersMap = await getClerkUserIdMap(userIds);

  const usersWithDetails = userRecords.map((user) => ({
    ...user,
    ...usersMap.get(user.id),
  }));

  return {
    users: usersWithDetails,
  };
}

export default async function UsersPage() {
  const userData = await getUsers();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <UserManagement data={userData} />
    </div>
  );
}
`
const searchContent = `import UserManagement from './UserManagement'`
const replaceContent = "import { UserManagement } from './'"
function findOneLinerMatch(content: string, searchContent: string) {
	const contentLines = content.split("\n")
	const searchLines = searchContent.split("\n")
	if (searchLines.length > 1) {
		return { success: false }
	}
	const indexOfSearch = contentLines.findIndex((line) => line.includes(searchContent))
	if (indexOfSearch === -1) {
		return { success: false }
	}
	const replacedContent = contentLines[indexOfSearch].replace(searchContent, replaceContent)
	return {
		success: true,
		lineStart: indexOfSearch,
		lineEnd: indexOfSearch,
		replacedContent,
	}
}
const result = findOneLinerMatch(content, searchContent)
console.log(result)
