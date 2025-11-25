import { getFunctions, renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import dotenv from "dotenv";
import { IAMClient, GetRoleCommand } from "@aws-sdk/client-iam";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { AwsRegion } from "@remotion/lambda";

dotenv.config();

const region = (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
// Copy credentials immediately
if (process.env.REMOTION_AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = process.env.REMOTION_AWS_ACCESS_KEY_ID;
if (process.env.REMOTION_AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
process.env.AWS_REGION = region;

const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL;
const bucketName = process.env.REMOTION_BUCKET;

async function test() {
    console.log("🔍 Testing Remotion Lambda Configuration...");
    console.log(`📍 Region: ${region}`);

    if (!process.env.REMOTION_AWS_ACCESS_KEY_ID || !process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
        console.error("❌ AWS Credentials not found in environment variables.");
        return;
    }
    console.log("✅ AWS Credentials found.");

    // 1. Check IAM Role
    try {
        const iam = new IAMClient({
            region,
            credentials: {
                accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
            }
        });
        const { ListAttachedRolePoliciesCommand } = await import("@aws-sdk/client-iam");
        const policies = await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: "remotion-lambda-role" }));
        console.log("✅ IAM Role 'remotion-lambda-role' exists.");
        console.log("   Attached Policies:", policies.AttachedPolicies?.map(p => p.PolicyName).join(", "));
    } catch (e: any) {
        console.error("❌ IAM Role check failed:", e.message);
    }

    // 2. Check S3 Bucket
    if (bucketName) {
        try {
            const s3 = new S3Client({
                region,
                credentials: {
                    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
                }
            });
            const { Buckets } = await s3.send(new ListBucketsCommand({}));
            const exists = Buckets?.some(b => b.Name === bucketName);
            if (exists) {
                console.log(`✅ S3 Bucket '${bucketName}' exists.`);
            } else {
                console.error(`❌ S3 Bucket '${bucketName}' not found in account.`);
            }
        } catch (e: any) {
            console.error("❌ S3 Bucket check failed:", e.message);
        }
    } else {
        console.warn("⚠️ REMOTION_BUCKET not set.");
    }

    // 3. Check Lambda Function
    if (functionName) {
        try {
            const functions = await getFunctions({ region, compatibleOnly: true });
            const exists = functions.some(f => f.functionName === functionName);
            if (exists) {
                console.log(`✅ Lambda Function '${functionName}' exists.`);
            } else {
                console.error(`❌ Lambda Function '${functionName}' not found.`);
                console.log("Available functions:", functions.map(f => f.functionName));
            }
        } catch (e: any) {
            console.error("❌ Lambda Function check failed:", e.message);
        }
    } else {
        console.warn("⚠️ REMOTION_LAMBDA_FUNCTION_NAME not set.");
    }

    // 4. Test Render (Optional)
    if (functionName && serveUrl && bucketName) {
        console.log("\n🧪 Attempting a dry-run render...");
        console.log(`   Serve URL: ${serveUrl}`);

        // Check if Serve URL is reachable
        try {
            const res = await fetch(serveUrl, { method: 'HEAD' });
            console.log(`   Serve URL Reachable: ${res.status} ${res.statusText}`);
        } catch (e: any) {
            console.warn(`   ⚠️ Serve URL might be unreachable: ${e.message}`);
        }

        try {
            console.log("   Calling getCompositionsOnLambda...");
            const { getCompositionsOnLambda } = await import("@remotion/lambda/client");
            const comps = await getCompositionsOnLambda({
                region,
                functionName,
                serveUrl,
                inputProps: {},
                envVariables: {},
            });
            console.log(`✅ Compositions found: ${comps.map(c => c.id).join(", ")}`);

            console.log("   Calling renderMediaOnLambda...");
            const renderPromise = renderMediaOnLambda({
                region,
                functionName,
                serveUrl,
                composition: "slider-reveal",
                inputProps: {
                    // Use minimal props to avoid asset processing issues
                    topImages: [],
                    bottomImages: [],
                },
                codec: "h264",
                framesPerLambda: 10,
                logLevel: "verbose",
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout waiting for renderMediaOnLambda")), 15000)
            );

            const { renderId, bucketName: renderBucket } = await Promise.race([renderPromise, timeoutPromise]) as any;

            console.log(`✅ Render started! ID: ${renderId}, Bucket: ${renderBucket}`);
            console.log("Waiting for progress...");

            const progress = await getRenderProgress({
                region,
                bucketName: renderBucket,
                renderId,
                functionName,
            });
            console.log("Progress:", progress);

        } catch (e: any) {
            console.error("❌ Render failed:", e.message);
            if (e.stack) console.error(e.stack);
        }
    }

    // 5. Test Direct Invocation (AWS SDK) with Payload
    console.log("\n⚡ Testing Direct Lambda Invocation with Payload...");
    try {
        const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
        const lambda = new LambdaClient({
            region,
            credentials: {
                accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
            }
        });

        const payload = JSON.stringify({
            type: "get-compositions",
            serveUrl: serveUrl,
            inputProps: {},
        });

        const command = new InvokeCommand({
            FunctionName: functionName,
            Payload: new TextEncoder().encode(payload),
        });

        const response = await lambda.send(command);
        console.log(`✅ Direct Invocation successful. Status: ${response.StatusCode}`);

        if (response.Payload) {
            const result = new TextDecoder().decode(response.Payload);
            console.log("   Response Payload:", result);
        }
    } catch (e: any) {
        console.error("❌ Direct Invocation failed:", e.message);
    }
    // 6. Fetch CloudWatch Logs
    console.log("\n📜 Fetching CloudWatch Logs...");
    try {
        const { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
        const cwl = new CloudWatchLogsClient({
            region,
            credentials: {
                accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
            }
        });

        const logGroupName = `/aws/lambda/${functionName}`;
        const streams = await cwl.send(new DescribeLogStreamsCommand({
            logGroupName,
            orderBy: "LastEventTime",
            descending: true,
            limit: 1,
        }));

        if (streams.logStreams && streams.logStreams.length > 0) {
            const streamName = streams.logStreams[0].logStreamName;
            console.log(`   Log Stream: ${streamName}`);
            const events = await cwl.send(new GetLogEventsCommand({
                logGroupName,
                logStreamName: streamName,
                limit: 20,
            }));

            console.log("   --- LOGS ---");
            events.events?.forEach(e => {
                console.log(`   [${new Date(e.timestamp!).toISOString()}] ${e.message?.trim()}`);
            });
            console.log("   --- END LOGS ---");
        } else {
            console.log("   No log streams found.");
        }
    } catch (e: any) {
        console.error("❌ Failed to fetch logs:", e.message);
    }
}

test();
