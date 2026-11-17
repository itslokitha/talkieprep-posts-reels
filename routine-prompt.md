You are running TalkiePrep's daily content routine. Follow CLAUDE.md for voice, look and formats.

1. Use today's date in Halifax time (America/Halifax) as YYYY-MM-DD. If a folder for today
   already exists in /content, stop and do nothing.
2. Read rotation.md and find the NEXT number.
3. Do the task for that number:

   1 – IDEAS
   - If next-idea.md has text under MY IDEA, develop that idea using the IDEAS style
     (title, why it lands, Day 2 / Day 3 / Day 4 angles) and write it under CHOSEN as the final plan.
   - Otherwise write 5 ideas under OPTIONS following the IDEAS style, leave CHOSEN empty,
     and add the 4 ideas not marked as recommended to the bottom of ideas.md for later.
   - Save a copy in /content/YYYY-MM-DD-ideas/ideas.md.

   2 – POST (angle A), 3 – REEL, 4 – POST (angle B)
   - Read next-idea.md. If CHOSEN has a plan or a number, use that idea. If CHOSEN is empty,
     use idea 1 from OPTIONS and write "1 (auto-picked)" under CHOSEN.
   - Day 2: create the post in /content/YYYY-MM-DD-post/ using the Day 2 angle.
   - Day 3: create the reel in /content/YYYY-MM-DD-reel/ using the Day 3 angle.
   - Day 4: create the post in /content/YYYY-MM-DD-post/ using the Day 4 angle, in a different
     format from the Day 2 post (check its folder).
   - Render the visuals (see CLAUDE.md and tools/README.md). Write the source HTML in
     build/ (git-ignored), never in /content:
     - Posts: `node tools/render-post.js build/YYYY-MM-DD-post/slides.html content/YYYY-MM-DD-post`
       → slide-01.png, slide-02.png, … (1080×1350).
     - Reel: `node tools/render-reel.js build/YYYY-MM-DD-reel/reel.html content/YYYY-MM-DD-reel`
       → reel.mp4 (1080×1920, 30 fps) + cover.png.
   - Check the output before committing: the script must finish without "RENDER FAILED" and
     with 0 layout warnings (fix the HTML and re-render if not). Look at the PNGs, and for the
     reel look at a few frames pulled from reel.mp4 with ffmpeg. Fix anything clipped, overlapping
     or unreadable.
   - If rendering fails and you can't fix it (e.g. fonts can't load), still commit the text files,
     and send a notification saying which file is missing and why.
   - The content folder must contain no .html files.
   - After the Day 4 post, reset next-idea.md to its empty template (keep the section headings
     and comments) so the next cycle starts clean.

4. Add a row to content-log.md (date, type, idea title, folder).
5. Update NEXT in rotation.md (1→2, 2→3, 3→4, 4→1).
6. Commit everything with the message "Daily content: YYYY-MM-DD <type>" and push to main.
