1. it is always difficult to human read the multi-agent chat logs, especially when there's even an environment input and output, so we want to have a visually appealing approach in show it.

2. aside the visually appealing way of showing it, there should be a graph that dynamically growth with timestamp showing the interactions of the agents. Here the graph should not contain all the chats the agent have, but be an abstracted summary of what the agent action is. So itt fits into the idea of process mining. And we can define our deep analytics here as the process minining. Given input chatlogs, there should be a default abstraction method that bastracting the agent chats, and label the chatlog. THen, there should be a mining algorithm  detecting the agent chat.

3. building on the top of such graph, there can also be some important checkpoints where the agent succeed / failed in some important process that marks the process. However, as this is problem driven and context dependent, we can only provde few conceret example for this. And it would need the user to define the important checkpoints

4. as a web view, there should also be a place that allows for generating the final reportt building on the web. For generating the report, the user should be allowed to input some thoughts during the process. So the text input message shall be allowed. 


If we can finish these steps, the commugraph is then built. So we can now starting work on it!