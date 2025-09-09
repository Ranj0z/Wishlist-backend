// Database
import { eq, sql } from "drizzle-orm";
import { TIUsers, usersTable } from "../../Drizzle/schema";
import db from "../../Drizzle/db";

// Register user
export const createUserService = async (user: TIUsers) => {
  await db.insert(usersTable).values(user);
  return "User created successfully";
};

// Get user by Email
export const getUserByEmailService = async (email: string) => {
  return await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });
};

// Verify User
export const verifyUserService = async (email: string) => {
  await db
    .update(usersTable)
    .set({ isVerified: true, verificationCode: null })
    .where(eq(usersTable.email, email));
};

// Login a user
export const userLoginService = async (user: Partial<TIUsers>) => {
  const { email } = user;

  if (!email) return null;

  const loggedInUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  return loggedInUser;
};

// Get All Existing Users
export const getAllUsersService = async () => {
  const allUsers = await db.query.usersTable.findMany();
  return allUsers;
};

// Get User By UserID
export const getUserByIDService = async (ID: number) => {
  const userByID = await db.query.usersTable.findFirst({
    where: eq(usersTable.userId, ID),
  });
  return userByID;
};

// Update a User by ID
export const updateUserService = async (
  ID: number,
  userUpdated: Partial<TIUsers>
) => {
  const [updated] = await db
    .update(usersTable)
    .set(userUpdated)
    .where(eq(usersTable.userId, ID))
    .returning();

  return updated;
};

// Update a User to Admin
export const updateUserToAdminService = async (ID: number) => {
  const [updated] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.userId, ID))
    .returning();

  return updated;
};

// Update a User back to Normal User
export const updateUserToNormalService = async (ID: number) => {
  const [updated] = await db
    .update(usersTable)
    .set({ role: "user" })
    .where(eq(usersTable.userId, ID))
    .returning();

  return updated;
};

// Delete User By ID
export const deleteUserService = async (ID: number) => {
  const deletedUser = await db
    .delete(usersTable)
    .where(eq(usersTable.userId, ID));
  return deletedUser;
};
