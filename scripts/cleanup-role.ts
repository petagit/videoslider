import { IAMClient, DeleteRoleCommand, ListAttachedRolePoliciesCommand, DetachRolePolicyCommand, ListRolesCommand } from "@aws-sdk/client-iam";
import dotenv from "dotenv";

dotenv.config();

const client = new IAMClient({
  region: process.env.REMOTION_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  console.log(`🧹 Cleaning up all Remotion roles...`);

  try {
    const roles = await client.send(new ListRolesCommand({}));
    const remotionRoles = roles.Roles?.filter(r => r.RoleName?.includes("remotion")) || [];

    if (remotionRoles.length === 0) {
        console.log("✅ No Remotion roles found.");
        return;
    }

    for (const role of remotionRoles) {
        const roleName = role.RoleName!;
        console.log(`   - Processing role: ${roleName}`);
        
        // 1. Detach all policies first
        const policies = await client.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }));
        if (policies.AttachedPolicies) {
        for (const policy of policies.AttachedPolicies) {
            console.log(`     - Detaching ${policy.PolicyName}...`);
            await client.send(new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policy.PolicyArn }));
        }
        }

        // 2. Delete the role
        console.log(`     - Deleting role ${roleName}...`);
        await client.send(new DeleteRoleCommand({ RoleName: roleName }));
    }
    
    console.log("✅ All roles cleaned up.");
  } catch (e: any) {
      console.error("❌ Failed to cleanup roles:", e.message);
  }
}

main();

