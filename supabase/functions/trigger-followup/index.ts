import { createClient } from "@supabase/supabase-js";
import { createFollowupHandler } from "./handler.ts";

Deno.serve(createFollowupHandler({ createClient, env: name => Deno.env.get(name), fetch }));
