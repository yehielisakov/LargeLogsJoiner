# LargeLogsJoiner
Some logic to demonstrate how to join large files (in this case, log files)
Currently, it does the work (stream based logic uses the basic fs component, line reader based uses an external library, both 
implementations are in main.ts, one creates "merge_result.log" file and the other "merge_result_tow.log". One can check the result by
running wc -l *.log in input directory), logic uses streams.

Notes:
1. Line parsing logic (in stream based): line is until one gets the first "\n", but in order to make it generic it should be a regex
   with the following elements: start (in our case regex that describes the timestamp) and end (in our case if we get to "start" this 
   means that we are to begin a new line).
2. Comparison logic / merge logic - in our case merge is done by timestamp so we can keep the reuslting file ordered (each one of the 
   input streams is ordered by timestamp in ascending order)
   
In order to make the solution generic elements 1. and 2. should be either as input to merge class or should be out of the merge class 
(which would mean that we have to create a separate reader-writer class that only handles read / write ops and merge class will call
it as needed).  

In order to run (Webstorm) get the files, put them in separate dir, run npm install, then create Webstorm configuration to run main.ts

