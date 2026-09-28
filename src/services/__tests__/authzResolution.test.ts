jest.mock("../supabase", () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
import { supabase } from "../supabase";
import { resolveAppRole } from "../authz";
const db = supabase!;
const from = db.from as jest.Mock;
const session = db.auth.getSession as jest.Mock;
test("editable user metadata cannot grant an admin role", async () => {
 session.mockResolvedValue({data:{session:{user:{id:"A",app_metadata:{},user_metadata:{role:"ADMIN"}}}}});
 const maybeSingle = jest.fn().mockResolvedValue({data:{role:"OPERADOR"},error:null});
 from.mockReturnValue({select:()=>({eq:()=>({maybeSingle})})});
 expect(await resolveAppRole()).toBe("OPERADOR");
});
test("missing session and profile errors fail closed", async () => {
 session.mockResolvedValue({data:{session:null}});
 expect(await resolveAppRole()).toBeNull();
 session.mockResolvedValue({data:{session:{user:{id:"A",app_metadata:{}}}}});
 from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({error:{message:"42P01 relation absent"}})})})});
 expect(await resolveAppRole()).toBeNull();
});
