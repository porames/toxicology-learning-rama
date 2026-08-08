import admin from "firebase-admin";
import {cert} from "firebase-admin/app";

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) {
        args[arg.slice(2)] = true;
      } else {
        args[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    }
  }
  return args;
}

const VALID_ROLES = ["student", "resident", "teacher", "admin"];

admin.initializeApp({credential: cert("../secret/serviceAccount.json")});

const db = admin.firestore();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email;
  const ramaId = args.rama_id;
  const authId = args.authId || args.uid;
  const role = args.role;

  if (!role || !VALID_ROLES.includes(role)) {
    console.error(`--role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  if (!email && !ramaId && !authId) {
    console.error("Usage: node scripts/updateUserRole.js --role=<role> --email=<email>");
    console.error("       node scripts/updateUserRole.js --role=<role> --rama_id=<id>");
    console.error("       node scripts/updateUserRole.js --role=<role> --authId=<uid>");
    process.exit(1);
  }

  const provided = [email, ramaId, authId].filter(Boolean).length;
  if (provided > 1) {
    console.error("Provide only one of --email, --rama_id, or --authId.");
    process.exit(1);
  }

  let query;
  if (email) {
    query = db.collection("users").where("email", "==", email).limit(1);
  } else if (ramaId) {
    query = db.collection("users").where("rama_id", "==", ramaId).limit(1);
  } else {
    query = db.collection("users").where("authId", "==", authId).limit(1);
  }

  const snap = await query.get();
  if (snap.empty) {
    console.error(`No user found for ${email ? "email" : ramaId ? "RAMA ID" : "authId"}: ${email || ramaId || authId}`);
    process.exit(1);
  }

  const userDoc = snap.docs[0];
  const data = userDoc.data();
  const docId = userDoc.id;

  await userDoc.ref.update({role});
  console.log(`Updated users/${docId} role -> ${role}.`);

  if (data.authId) {
    await admin.auth().setCustomUserClaims(data.authId, {role});
    console.log(`Set custom claim role=${role} on ${data.authId}.`);
  } else {
    console.warn("User has no Firebase Auth account (authId missing); custom claim not set.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
