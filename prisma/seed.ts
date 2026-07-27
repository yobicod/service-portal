import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Priority,
  PrismaClient,
  ReportStatus,
  Role,
  TaskStatus,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required to seed the database.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const passwordHash = await hash("ChangeMe123!", 12);
  const requester = await prisma.user.upsert({
    where: { email: "requester@example.test" },
    update: { name: "Visal Phirun", role: Role.USER, passwordHash },
    create: {
      id: "demo-requester",
      name: "Visal Phirun",
      email: "requester@example.test",
      role: Role.USER,
      passwordHash,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.test" },
    update: { name: "System Admin", role: Role.ADMIN, passwordHash },
    create: {
      id: "demo-admin",
      name: "System Admin",
      email: "admin@example.test",
      role: Role.ADMIN,
      passwordHash,
    },
  });
  const staff = await prisma.user.upsert({
    where: { email: "staff@example.test" },
    update: { name: "Somchai Maintenance", role: Role.STAFF, passwordHash },
    create: {
      id: "demo-staff",
      name: "Somchai Maintenance",
      email: "staff@example.test",
      role: Role.STAFF,
      passwordHash,
    },
  });

  const report = await prisma.maintenanceReport.upsert({
    where: { referenceNo: "MR-DEMO-0001" },
    update: {},
    create: {
      referenceNo: "MR-DEMO-0001",
      reporterId: requester.id,
      title: "Air conditioner leaking",
      description:
        "Water is dripping from the indoor unit near the front desk.",
      category: "Air conditioner",
      location: "Room 302 · Building A",
      priority: Priority.HIGH,
      status: ReportStatus.IN_PROGRESS,
      statusLogs: {
        create: [
          {
            changedById: requester.id,
            toStatus: ReportStatus.SUBMITTED,
            comment: "Maintenance request submitted.",
          },
          {
            changedById: admin.id,
            fromStatus: ReportStatus.SUBMITTED,
            toStatus: ReportStatus.ASSIGNED,
            comment: "Task assigned to staff.",
          },
        ],
      },
    },
  });

  await prisma.maintenanceTask.upsert({
    where: { id: "demo-task-0001" },
    update: {},
    create: {
      id: "demo-task-0001",
      reportId: report.id,
      assignedStaffId: staff.id,
      assignedByAdminId: admin.id,
      instruction: "Inspect the drain line and resolve the source of the leak.",
      dueDate: new Date("2026-07-28T09:00:00.000Z"),
      status: TaskStatus.IN_PROGRESS,
    },
  });

  await prisma.maintenanceReport.upsert({
    where: { referenceNo: "MR-DEMO-0002" },
    update: {},
    create: {
      referenceNo: "MR-DEMO-0002",
      reporterId: requester.id,
      title: "Light bulb needs replacement",
      description:
        "Two ceiling lights above the study tables are no longer working.",
      category: "Electrical",
      location: "Library · Floor 2",
      priority: Priority.LOW,
      status: ReportStatus.SUBMITTED,
      statusLogs: {
        create: {
          changedById: requester.id,
          toStatus: ReportStatus.SUBMITTED,
          comment: "Maintenance request submitted.",
        },
      },
    },
  });

  const queueReports = [
    {
      referenceNo: "MR-DEMO-0003",
      title: "Water tap dripping in washroom",
      category: "Plumbing",
      location: "Building B · Floor 1",
      priority: Priority.MEDIUM,
      status: ReportStatus.SUBMITTED,
    },
    {
      referenceNo: "MR-DEMO-0004",
      title: "Projector will not turn on",
      category: "Electrical",
      location: "Meeting room 4",
      priority: Priority.HIGH,
      status: ReportStatus.UNDER_REVIEW,
    },
    {
      referenceNo: "MR-DEMO-0005",
      title: "Ceiling tile damaged after leak",
      category: "Building",
      location: "Building A · Floor 3",
      priority: Priority.MEDIUM,
      status: ReportStatus.APPROVED,
    },
    {
      referenceNo: "MR-DEMO-0006",
      title: "Door closer needs adjustment",
      category: "Building",
      location: "Library entrance",
      priority: Priority.LOW,
      status: ReportStatus.ASSIGNED,
    },
    {
      referenceNo: "MR-DEMO-0007",
      title: "Internet outlet is loose",
      category: "IT equipment",
      location: "Computer lab 2",
      priority: Priority.MEDIUM,
      status: ReportStatus.IN_PROGRESS,
    },
    {
      referenceNo: "MR-DEMO-0008",
      title: "Elevator call button is unresponsive",
      category: "Elevator",
      location: "Building C · Ground floor",
      priority: Priority.HIGH,
      status: ReportStatus.COMPLETED_BY_STAFF,
    },
    {
      referenceNo: "MR-DEMO-0009",
      title: "Window lock is difficult to close",
      category: "Building",
      location: "Room 214 · Building B",
      priority: Priority.LOW,
      status: ReportStatus.NEEDS_REVISION,
    },
    {
      referenceNo: "MR-DEMO-0010",
      title: "Air conditioner makes a loud noise",
      category: "Air conditioner",
      location: "Room 105 · Building A",
      priority: Priority.HIGH,
      status: ReportStatus.CLOSED,
    },
    {
      referenceNo: "MR-DEMO-0011",
      title: "Emergency light requires inspection",
      category: "Electrical",
      location: "Building D · Floor 2",
      priority: Priority.MEDIUM,
      status: ReportStatus.SUBMITTED,
    },
    {
      referenceNo: "MR-DEMO-0012",
      title: "Wall paint peeling near stairwell",
      category: "Building",
      location: "Building C · Stairwell 2",
      priority: Priority.LOW,
      status: ReportStatus.UNDER_REVIEW,
    },
    {
      referenceNo: "MR-DEMO-0013",
      title: "Water dispenser is not cooling",
      category: "Appliance",
      location: "Staff lounge",
      priority: Priority.MEDIUM,
      status: ReportStatus.APPROVED,
    },
    {
      referenceNo: "MR-DEMO-0014",
      title: "Parking area light is flickering",
      category: "Electrical",
      location: "North parking area",
      priority: Priority.HIGH,
      status: ReportStatus.ASSIGNED,
    },
  ];

  await Promise.all(
    queueReports.map((item) =>
      prisma.maintenanceReport.upsert({
        where: { referenceNo: item.referenceNo },
        update: {},
        create: {
          ...item,
          reporterId: requester.id,
          description: `Sample request: ${item.title}.`,
          statusLogs: {
            create: {
              changedById: requester.id,
              toStatus: item.status,
              comment: "Sample request created for pagination testing.",
            },
          },
        },
      }),
    ),
  );

  console.log("Seeded demo accounts:", {
    requester: requester.id,
    admin: admin.id,
    staff: staff.id,
  });
}

main().finally(async () => prisma.$disconnect());
