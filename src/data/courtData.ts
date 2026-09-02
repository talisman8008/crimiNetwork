import type { CourtDate } from "./types";

export const courtDates: CourtDate[] = [
  {
    id: "cd1",
    caseId: "case-1",
    hearingType: "Remand extension",
    court: "Special Court (NDPS Act), Panipat",
    judge: "R.K. Sharma",
    date: "2026-06-10",
    time: "11:00",
    status: "completed",
    notes: "Judicial remand extended by 14 days for Arvind Mehta and Suresh Kadam under BNSS S. 187.",
  },
  {
    id: "cd2",
    caseId: "case-1",
    hearingType: "Bail hearing: Arvind Mehta",
    court: "Special Court (NDPS Act), Panipat",
    judge: "R.K. Sharma",
    date: "2026-07-22",
    time: "10:30",
    status: "completed",
    notes:
      "Bail granted on satisfying the twin conditions under NDPS S. 37: surety of ₹2,00,000, weekly reporting to the investigating officer, passport surrendered.",
  },
  {
    id: "cd3",
    caseId: "case-2",
    hearingType: "Preliminary hearing",
    court: "Court of the Addl. Chief Metropolitan Magistrate, Esplanade, Mumbai",
    judge: "A. Deshmukh",
    date: "2026-07-05",
    time: "14:00",
    status: "completed",
    notes: "Charges read; prosecution granted 60 days to file chargesheet under BNSS S. 193.",
  },
  {
    id: "cd4",
    caseId: "case-1",
    hearingType: "Framing of charges",
    court: "Special Court (NDPS Act), Panipat",
    judge: "R.K. Sharma",
    date: "2026-09-15",
    time: "11:00",
    status: "upcoming",
    notes: "Investigating officer to be present with case diary.",
  },
  {
    id: "cd5",
    caseId: "case-2",
    hearingType: "Chargesheet filing",
    court: "Court of the Addl. Chief Metropolitan Magistrate, Esplanade, Mumbai",
    judge: "A. Deshmukh",
    date: "2026-09-02",
    time: "10:00",
    status: "upcoming",
    notes: "Deadline for filing chargesheet under the 60-day extension.",
  },
  {
    id: "cd6",
    caseId: "case-1",
    hearingType: "Evidence hearing",
    court: "Special Court (NDPS Act), Panipat",
    judge: "R.K. Sharma",
    date: "2026-10-20",
    time: "11:30",
    status: "upcoming",
  },
  {
    id: "cd7",
    caseId: "case-2",
    hearingType: "Next hearing",
    court: "Court of the Addl. Chief Metropolitan Magistrate, Esplanade, Mumbai",
    judge: "A. Deshmukh",
    date: "2026-11-11",
    time: "14:00",
    status: "upcoming",
  },
];

export function courtDatesForCase(caseId: string): CourtDate[] {
  return courtDates.filter((c) => c.caseId === caseId).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function upcomingCourtDates(limit?: number): CourtDate[] {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = courtDates.filter((c) => c.status === "upcoming" && c.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  return limit ? upcoming.slice(0, limit) : upcoming;
}
