<?php
echo "Checking ports...\n";
for ($port = 3000; $port <= 4000; $port++) {
    $fp = @fsockopen('localhost', $port, $errno, $errstr, 0.1);
    if ($fp) {
        echo "Found something on port: $port\n";
        fclose($fp);
    }
}
echo "Done.";
?>
