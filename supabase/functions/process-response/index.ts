import { createClient } from "@supabase/supabase-js";
import { createResponseHandler } from "./handler.ts";

Deno.serve(createResponseHandler({ createClient, env: name => Deno.env.get(name), fetch }));
