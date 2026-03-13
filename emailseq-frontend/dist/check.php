<?php
echo "<h1>Hostinger Node.js Environment Check</h1>";
echo "<b>CWD:</b> " . getcwd() . "<br>";
echo "<b>Document Root:</b> " . $_SERVER['DOCUMENT_ROOT'] . "<br>";
echo "<b>Script Name:</b> " . $_SERVER['SCRIPT_NAME'] . "<br>";
echo "<b>Files in this folder:</b><br>";
print_r(scandir('.'));
?>
