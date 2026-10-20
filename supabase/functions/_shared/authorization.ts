export interface MembershipClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string | number): {
        eq(column: string, value: string | number): {
          maybeSingle(): PromiseLike<{ data: { role: string } | null; error: unknown }>;
        };
      };
    };
  };
}

export async function allowedRole(client: MembershipClient, userId: string, roles: readonly string[]): Promise<boolean> {
  const { data, error } = await client.from("event_memberships").select("role")
    .eq("event_id", 17135).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("membership_unavailable");
  return data !== null && roles.includes(data.role);
}
