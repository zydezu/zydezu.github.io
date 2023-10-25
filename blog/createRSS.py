import os, subprocess, time, datetime, sys
import re
from email import utils
from datetime import datetime

blogSite = "https://zydezu.github.io/blog/"

#getTimeNow
timeNow = datetime.now().strftime("%H:%M-%Y-%m-%d")
timeNow = datetime.strptime(timeNow, "%H:%M-%Y-%m-%d")
timeNow = utils.format_datetime(timeNow)

#store rsstemplate.txt file
with open('rsstemplate.xml', 'r') as f:
  rsstemplate = f.readlines()
for i in range(len(rsstemplate)):
  rsstemplate[i] = rsstemplate[i].format(timenow = timeNow)

#get lines of index.html
with open("index.html", 'r', encoding="utf8") as f:
  content = f.readlines()

#loop until end
post = 0
for i in range(len(content)):
  if 'class="postn' in content[i]:
    post = 1
    postData = []
    link = ""
    image = ""
    
    #post found
    while post == 1:
      i+=1
      temp = re.sub('<[^<>]+>', '', content[i]).strip()
      if not link:
        temp2 = []
        temp2 = content[i].split('"')
        locallink = temp2[3]
        link = blogSite + temp2[3]
      if 'class="image"' in content[i] and not image:
        temp2 = []
        temp2 = content[i].split('"')
        if 'loading="lazy"' in content[i]:
          image = temp2[5]
        else:
          image = temp2[3]
        fileType = image.split(".")[-1]

      if len(temp)>1 and len(postData) < 3:
        postData.append(temp.replace('|', '').strip()) #get content in tags
      if 'div' in content[i] and not 'div class' in content[i]: #post end
        post = 0
        
        #convert date to correct format
        timeTemp = postData[2].split(' ')
        date = timeTemp[0]
        if (len(timeTemp) > 1):
          nowdt = datetime.strptime(postData[2].replace(' ','-'), "%H:%M-%Y-%m-%d")
        else:
          postData[2] = "00:00 " + postData[2]
          nowdt = datetime.strptime(postData[2].replace(' ','-'), "%H:%M-%Y-%m-%d")
        postData[2] = utils.format_datetime(nowdt)
        
        #get lines from actual blog file
        with open(locallink+"index.html", 'r', encoding="utf8") as f:
          blogcontent = f.readlines()
          
          startline = 20
          #find start of blog body content
          for h in range(len(blogcontent)):
            if 'a class="tagHeader"' in blogcontent[h]:
              startline = h
          startline+=1

          #delete unneeded lines
          for h in range(startline):
            del blogcontent[0]

          endline = len(blogcontent) - 7
          try: #try find end
            for h in range(len(blogcontent)):
              if 'id="commentSection"' in blogcontent[h] or 'iframe src="https://kinositecomments' in blogcontent[h]:
                endline = h
          except:
            print("Failed to find end of blog page, using fallback value")

          #delete unneeded lines
          for h in range(len(blogcontent) - endline):
            del blogcontent[len(blogcontent)-1]

          #replace src="
          for h in range(len(blogcontent)):
            if 'src=' in blogcontent[h]:
              tempvalue = blogcontent[h]
              index = tempvalue.find('src=')
              newsrc = tempvalue[index:index+5]+locallink
              blogcontent[h] = tempvalue[:index] + newsrc + tempvalue[index+5:]

          blogdescription = ''.join(blogcontent).replace("\n", "")

        blogdescription = postData[1] + ' | <a href="' +link+ '">Open page in web</a><br/>' + blogdescription
        
        #generate data
        template = [] #store rsstemplate.txt file
        with open('rsstemplate.txt', 'r') as f:
          template = f.readlines()

        #check if image is blank
        if image:
          image = blogSite + image
        
        for k in range(0,8):
          template[k] = template[k].format(title = postData[0], link = link, description = blogdescription,
                                           image = image, fileType = fileType, date = postData[2])
        if not image:
          del template[4]
          del template[4]

        template.append("\n")
        for j in range(len(template)):
          rsstemplate.append(template[j])
          
rsstemplate.append('\n</channel>')
rsstemplate.append('\n</rss>')

#write to file
with open('rss.xml', 'w', encoding="utf8") as f:
    f.writelines(rsstemplate)

print("Done")
time.sleep(1)
