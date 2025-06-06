// pages/index.js
 export default function Home() {
   return (
     <div style={{ padding: 20 }}>
       <h1>Welcome to Fantasy Spreads League</h1>
-      <p>
-        This is the homepage. You can:
-      </p>
-      <ul>
-        <li>
-          <a href="/admin">Go to Admin (enter weekly games)</a>
-        </li>
-        <li>
-          <a href="/picks">Submit Your Picks</a>
-        </li>
-      </ul>
+      <p>This is the homepage. You can:</p>
+      <ul>
+        <li>
+          <a href="/admin">Go to Admin (enter weekly games)</a>
+        </li>
+        <li>
+          <a href="/picks">Submit Your Picks</a>
+        </li>
+        <li>
+          <a href="/profile">View My Profile & Picks</a>
+        </li>
+      </ul>
     </div>
   )
 }
