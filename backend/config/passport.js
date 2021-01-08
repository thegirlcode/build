const passport = require("passport");
const bcrypt = require("bcrypt");
const { Strategy: LocalStrategy } = require("passport-local");
const { PrismaClient } = require("@prisma/client");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const creds = require("../client_secret.json");

const client = new PrismaClient();

let doc;

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await client.user.findOne({
          where: { email },
        });

        if (user) {
          if (await bcrypt.compare(password, user.password)) {
            return done(null, user);
          }

          return done("Incorrect password");
        } else {
          if (!doc) {
            doc = new GoogleSpreadsheet(
              process.env.SHEETS_URL
            );
            await doc.useServiceAccountAuth(creds);
            await doc.getInfo();
          }

          const emails = [...(await doc.sheetsByIndex[0].getRows())].map((r) =>
            r._rawData[0].trim()
          );

          const info = [...(await doc.sheetsByIndex[0].getRows())].map((r) =>
            r._rawData[1].trim()
          );

          console.log(info);
          if (emails.indexOf(email) === -1) {
            return done("This email is not associated to a build participant");
          }

          else
          {
            var n = emails.indexOf(email);
            console.log(n, info[n]);
            var track = JSON.parse(info[n]);
            console.log(track, typeof(track)); 
            
          }

          const user_ = await client.user.create({
            data: { email, password: await bcrypt.hash(password, 14) },
          });

          // Add donor badge
          await client.badge.create({
            data: {
              User: { connect: { id: user_.id } },
              img: "https://i.imgur.com/8DmfRD8.png",
            },
          });

          return done(null, user_);
        }
      } catch (e) {
        done(e);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((token, done) =>
  client.user
    .findOne({ where: { id: token } })
    .then((u) => (u ? done(null, u) : done("User not found")))
    .catch(done)
);
