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

admin.initializeApp({credential: cert("../secret/serviceAccount.json")});

const db = admin.firestore();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email;
  const ramaId = args.rama_id;
  const authId = args.authId || args.uid;
  const password = args.password;

  if (!email && !ramaId && !authId) {
    console.error("Usage: node scripts/createAdmin.js --email=<email> [--password=<pw>]");
    console.error("       node scripts/createAdmin.js --rama_id=<id> [--password=<pw>]");
    console.error("       node scripts/createAdmin.js --authId=<uid> [--password=<pw>]");
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
  let uid = data.authId;

  if (!uid) {
    if (!password) {
      console.error(
        `User "${docId}" has no Firebase Auth account. Provide --password to create one, ` +
          "or have the user sign up first.",
      );
      process.exit(1);
    }
    const userRecord = await admin.auth().createUser({
      email: data.email || email,
      password,
      displayName: data.name,
    });
    uid = userRecord.uid;
    await userDoc.ref.update({
      authId: uid,
      signedUp: true,
      signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Created Auth account for ${data.email || email} (uid ${uid}).`);
  }

  await userDoc.ref.update({role: "admin"});
  console.log(`Updated users/${docId} role -> admin.`);

  await admin.auth().setCustomUserClaims(uid, {role: "admin"});
  console.log(`Set custom claim role=admin on ${uid}.`);

  console.log("Done. Admin privileges granted.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
