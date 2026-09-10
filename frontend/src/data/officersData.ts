import type { CaseAssignment, Officer } from "./types";

export const officers: Officer[] = [
  { id: "PB-0942", name: "Insp. R. Chauhan", rank: "Inspector", station: "Central Crime Station, Sector 14", phone: "0180-2645-0942" },
  { id: "PB-1655", name: "SI P. Nair", rank: "Sub-Inspector", station: "Economic Offences Wing", phone: "022-2266-1655" },
  { id: "PB-2214", name: "Const. M. Yadav", rank: "Constable", station: "Central Crime Station, Sector 14", phone: "0180-2645-2214" },
  { id: "PB-1187", name: "SI A. Bhatia", rank: "Sub-Inspector", station: "Central Crime Station, Sector 14", phone: "0180-2645-1187" },
  { id: "PB-2578", name: "Const. P. Rawat", rank: "Constable", station: "Central Crime Station, Sector 14", phone: "0180-2645-2578" },
  { id: "PB-1892", name: "HC S. Iyer", rank: "Head Constable", station: "Economic Offences Wing", phone: "022-2266-1892" },
  { id: "PB-1420", name: "ASI K. Deshpande", rank: "Assistant Sub-Inspector", station: "Economic Offences Wing", phone: "022-2266-1420" },
];

export const caseAssignments: CaseAssignment[] = [
  { caseId: "case-1", officerId: "PB-0942", role: "Lead Investigating Officer" },
  { caseId: "case-1", officerId: "PB-1187", role: "Field Officer" },
  { caseId: "case-1", officerId: "PB-2214", role: "Surveillance & Field Operations" },
  { caseId: "case-1", officerId: "PB-2578", role: "Surveillance & Field Operations" },
  { caseId: "case-2", officerId: "PB-1655", role: "Lead Investigating Officer" },
  { caseId: "case-2", officerId: "PB-1420", role: "Financial Forensics" },
  { caseId: "case-2", officerId: "PB-1892", role: "Records & Documentation" },
];

export function getOfficerById(id: string): Officer | undefined {
  return officers.find((o) => o.id === id);
}

export interface AssignedOfficer extends Officer {
  role: string;
}

export function officersForCase(caseId: string): AssignedOfficer[] {
  return caseAssignments
    .filter((a) => a.caseId === caseId)
    .map((a) => {
      const officer = getOfficerById(a.officerId);
      return officer ? { ...officer, role: a.role } : null;
    })
    .filter((o): o is AssignedOfficer => o !== null);
}
