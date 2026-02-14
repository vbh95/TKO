import { storage } from "../server/storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("Seeding database...");

  // Create a test user
  const password = await hashPassword("password123");
  
  // Check if user exists
  let user = await storage.getUserByUsername("demo@example.com");
  if (!user) {
    user = await storage.createUser({
      name: "Demo User",
      email: "demo@example.com",
      password,
    });
    console.log("Created user: demo@example.com / password123");
  } else {
    console.log("User demo@example.com already exists");
  }

  // Check if tournament exists for this user
  const existingTournaments = await storage.getTournamentsByUserId(user.id);
  if (existingTournaments.length === 0) {
    // Create a tournament
    const tournament = await storage.createTournament({
      userId: user.id,
      name: "Friday Night Darts",
      type: "ROUND_ROBIN",
      status: "IN_PROGRESS",
      settings: {
        groupCount: 2,
        promotedPerGroup: 2,
        matchFormat: { bestOf: 3 }
      }
    });
    console.log("Created tournament: Friday Night Darts");

    // Add players
    const playerNames = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace", "Heidi"];
    for (const name of playerNames) {
      await storage.createPlayer({
        tournamentId: tournament.id,
        name,
        seed: Math.floor(Math.random() * 10) + 1
      });
    }
    console.log("Added 8 players");
  } else {
    console.log("Tournament already exists");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
