<?php
// AI chat proxy for shared hosting (PHP 7.4+, cURL).
// 1) Create a file OUTSIDE public_html named anthropic-key.php containing:
//      <?php $ANTHROPIC_API_KEY = "sk-ant-...";
// 2) Upload this file as /chat.php and set AI_ENDPOINT = "/chat.php" in script.js
header("Content-Type: application/json; charset=utf-8");
$allowed = ["https://hrzoteck.online", "https://www.hrzoteck.online"];
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
if (in_array($origin, $allowed, true)) { header("Access-Control-Allow-Origin: $origin"); header("Vary: Origin"); }
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }
if ($_SERVER["REQUEST_METHOD"] !== "POST") { http_response_code(405); echo json_encode(["error" => "Method not allowed"]); exit; }

// simple per-IP rate limit: 20 requests / 10 minutes
$ip = $_SERVER["REMOTE_ADDR"] ?? "x";
$f = sys_get_temp_dir() . "/hrchat_" . md5($ip);
$hits = array_filter(is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [], fn($t) => $t > time() - 600);
if (count($hits) >= 20) { http_response_code(429); echo json_encode(["error" => "Too many requests"]); exit; }
$hits[] = time(); file_put_contents($f, json_encode(array_values($hits)));

require __DIR__ . "/../anthropic-key.php"; // outside the public web folder
$in = json_decode(file_get_contents("php://input"), true);
$msgs = [];
foreach (array_slice($in["messages"] ?? [], -12) as $m) {
  if (isset($m["role"], $m["content"]) && in_array($m["role"], ["user", "assistant"], true) && is_string($m["content"]))
    $msgs[] = ["role" => $m["role"], "content" => mb_substr($m["content"], 0, 1000)];
}
if (!$msgs || end($msgs)["role"] !== "user") { http_response_code(400); echo json_encode(["error" => "No question"]); exit; }

$system = file_get_contents(__DIR__ . "/ai-backend/system-prompt.txt");
$ch = curl_init("https://api.anthropic.com/v1/messages");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTPHEADER => ["x-api-key: $ANTHROPIC_API_KEY", "anthropic-version: 2023-06-01", "content-type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["model" => "claude-haiku-4-5-20251001", "max_tokens" => 450, "system" => $system, "messages" => $msgs]),
]);
$res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
if ($code !== 200) { http_response_code(502); echo json_encode(["error" => "AI unavailable"]); exit; }
$d = json_decode($res, true); $reply = "";
foreach ($d["content"] ?? [] as $b) if (($b["type"] ?? "") === "text") $reply .= $b["text"];
echo json_encode(["reply" => trim($reply) ?: "Sorry, I could not answer that. Please WhatsApp us on +91 70618 99614."]);
