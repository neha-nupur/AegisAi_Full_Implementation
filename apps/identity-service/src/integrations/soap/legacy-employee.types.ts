/** Result of a `CheckLegacyEmployee` SOAP call, mapped to camelCase for the REST layer. */
export interface LegacyEmployeeRecord {
  employeeId: string;
  exists: boolean;
  fullName: string | null;
  department: string | null;
  status: "ACTIVE" | "INACTIVE" | "NOT_FOUND";
}
