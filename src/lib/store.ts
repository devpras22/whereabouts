// Convex-backed data layer. Every read is a live subscription (useQuery);
// every write is a mutation against the deployment.
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBoard() {
  return useQuery(api.people.listBoard);
}

export function useSetStatus() {
  return useMutation(api.people.setStatus);
}

export function useParseMessage() {
  return useAction(api.parse.parseMessage);
}

export function useSendMyDigestNow() {
  return useAction(api.heidi.sendMyDigestNow);
}

export function useCreateTeam() {
  return useMutation(api.people.createTeam);
}

export function useUpdateMe() {
  return useMutation(api.people.updateMe);
}

export function useAddTeammate() {
  return useMutation(api.people.addTeammate);
}

export function useImportHolidays() {
  return useAction(api.holidays.importRegion);
}

export function useRenameTeam() {
  return useMutation(api.people.renameTeam);
}

export function useRemoveTeammate() {
  return useMutation(api.people.removeTeammate);
}
