import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "connected" });
  });

  // Fetch Users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        include: {
          attendances: {
            include: {
              event: true
            }
          },
          examResults: {
            include: {
              exam: {
                include: {
                  event: true
                }
              }
            }
          },
        }
      });
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch Events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await prisma.event.findMany({
        include: {
          exams: true,
          attendances: {
            include: {
              user: true
            }
          },
        }
      });
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload parsed excel data endpoint
  app.post("/api/upload", async (req, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ error: "Sıralı veri listesi (rows) bulunamadı." });
      }

      const results = [];

      for (const row of rows) {
        // Safe mapping of headers (Turkish and English headers)
        const firstName = row["Ad"] || row["firstName"] || "";
        const lastName = row["Soyad"] || row["lastName"] || "";
        const email = row["E-posta"] || row["Email"] || row["email"] || null;
        const company = row["Kurum"] || row["Company"] || row["company"] || null;
        const eventName = row["Eğitim Adı"] || row["Egitim Adi"] || row["eventName"] || null;
        const examName = row["Sınav Adı"] || row["Sinav Adi"] || row["examName"] || null;
        const rawScore = row["Sınav Puanı"] || row["Sinav Puani"] || row["score"] || null;
        const passingScore = parseInt(row["Geçme Notu"] || row["Gecme Notu"] || "70");

        if (!firstName || !lastName) continue;

        // 1. Find or create user
        let user;
        if (email) {
          user = await prisma.user.upsert({
            where: { email: email.toLowerCase().trim() },
            update: { firstName, lastName, company },
            create: { firstName, lastName, company, email: email.toLowerCase().trim() }
          });
        } else {
          user = await prisma.user.create({
            data: { firstName, lastName, company }
          });
        }

        // 2. Find or create Event
        let event;
        if (eventName) {
          const formattedEventName = eventName.trim();
          const existingEvent = await prisma.event.findFirst({
            where: { name: formattedEventName }
          });
          if (existingEvent) {
            event = existingEvent;
          } else {
            event = await prisma.event.create({
              data: {
                name: formattedEventName,
                date: new Date(),
                location: "Online Akademi"
              }
            });
          }

          // 3. Upsert Attendance
          await prisma.attendance.upsert({
            where: {
              userId_eventId: {
                userId: user.id,
                eventId: event.id
              }
            },
            update: {},
            create: {
              userId: user.id,
              eventId: event.id
            }
          });

          // 4. Find or create Exam
          if (examName) {
            const formattedExamName = examName.trim();
            const existingExam = await prisma.exam.findFirst({
              where: { name: formattedExamName, eventId: event.id }
            });
            let exam;
            if (existingExam) {
              exam = existingExam;
            } else {
              exam = await prisma.exam.create({
                data: {
                  name: formattedExamName,
                  passingScore: passingScore,
                  eventId: event.id
                }
              });
            }

            // 5. Upsert Exam Result
            if (rawScore !== null) {
              const score = parseInt(rawScore);
              const status = score >= exam.passingScore ? "Geçti" : "Kaldı";

              await prisma.examResult.upsert({
                where: {
                  userId_examId: {
                    userId: user.id,
                    examId: exam.id
                  }
                },
                update: { score, status },
                create: {
                  userId: user.id,
                  examId: exam.id,
                  score,
                  status
                }
              });
            }
          }
        }

        results.push(user);
      }

      res.json({ success: true, count: results.length });
    } catch (error: any) {
      console.error("Excel import error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update exam result score and status
  app.post("/api/update-result", async (req, res) => {
    try {
      const { userId, examId, score } = req.body;
      if (!userId || !examId || score === undefined) {
        return res.status(400).json({ error: "Eksik parametreler." });
      }

      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) {
        return res.status(404).json({ error: "Sınav bulunamadı." });
      }

      const parsedScore = parseInt(score);
      const status = parsedScore >= exam.passingScore ? "Geçti" : "Kaldı";

      const updated = await prisma.examResult.upsert({
        where: {
          userId_examId: {
            userId,
            examId
          }
        },
        update: { score: parsedScore, status },
        create: {
          userId,
          examId,
          score: parsedScore,
          status
        }
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Re-define/assign exam helper route
  app.post("/api/assign-exam", async (req, res) => {
    try {
      const { userId, eventId, examName, passingScore } = req.body;
      if (!userId || !eventId || !examName) {
        return res.status(400).json({ error: "Eksik parametreler." });
      }

      const exam = await prisma.exam.create({
        data: {
          name: examName,
          passingScore: parseInt(passingScore || "70"),
          eventId
        }
      });

      // assign empty result to initialize
      await prisma.examResult.create({
        data: {
          userId,
          examId: exam.id,
          score: 0,
          status: "Kaldı"
        }
      });

      res.json(exam);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
