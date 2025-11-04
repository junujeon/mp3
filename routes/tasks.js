module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
  
    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');
  
    // GET /api/tasks
    tasksRoute.get(async function (req, res) {
        try {
            const query = Task.find(JSON.parse(req.query.where || '{}'));
            if (req.query.sort) query.sort(JSON.parse(req.query.sort));
            if (req.query.select) query.select(JSON.parse(req.query.select));
            if (req.query.skip) query.skip(parseInt(req.query.skip));
            query.limit(parseInt(req.query.limit) || 100);
            const result = await query.exec();
    
            if (req.query.count === 'true') {
                res.status(200).json({ message: 'OK', data: result.length });
            } else {
                res.status(200).json({ message: 'OK', data: result });
            }
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // POST /api/tasks
    tasksRoute.post(async function (req, res) {
        try {
            if (!req.body.name || !req.body.deadline)
                return res.status(400).json({ message: 'Missing name or deadline', data: {} });

            if (req.body.completed === true) {
                return res.status(400).json({ message: 'Cannot assign a completed task', data: {} });
            }

            // validate assignedUser and assignedUserName consistency
            if (req.body.assignedUser) {
                const assignedUser = await User.findById(req.body.assignedUser);
                if (!assignedUser) {
                    return res.status(400).json({ message: 'Invalid assignedUser ID', data: {} });
                }
                if (req.body.assignedUserName && req.body.assignedUserName !== assignedUser.name) {
                    return res.status(400).json({ message: 'assignedUserName does not match user name', data: {} });
                }
                // make correct name
                req.body.assignedUserName = assignedUser.name;
            }
    
            const newTask = new Task(req.body);
            await newTask.save();
    
            // Add task to assigned user's pendingTasks (if assigned)
            if (newTask.assignedUser) {
                const user = await User.findById(newTask.assignedUser);
                if (user) {
                    user.pendingTasks.push(newTask._id.toString());
                    await user.save();
                }
            }
    
            res.status(201).json({ message: 'Task created', data: newTask });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: err });
        }
    });
  
    // GET /api/tasks/:id
    tasksIdRoute.get(async function (req, res) {
        try {
            const task = await Task.findById(req.params.id).select(JSON.parse(req.query.select || '{}'));;
            if (!task)
                return res.status(404).json({ message: 'Task not found', data: {} });
            res.status(200).json({ message: 'OK', data: task });
        } catch (err) {
            res.status(404).json({ message: 'Task not found', data: {} });
        }
    });
  
    // PUT /api/tasks/:id
    tasksIdRoute.put(async function (req, res) {
        try {
            const existing = await Task.findById(req.params.id);
            if (!existing)
                return res.status(404).json({ message: 'Task not found', data: {} });

            // validate required fields (same as POST)
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({ message: 'Missing name or deadline', data: {} });
            }
        
            // validate assignedUser and assignedUserName
            if (req.body.assignedUser) {
                const assignedUser = await User.findById(req.body.assignedUser);
                if (!assignedUser) {
                    return res.status(400).json({ message: 'Invalid assignedUser ID', data: {} });
                }
                if (req.body.assignedUserName && req.body.assignedUserName !== assignedUser.name) {
                    return res.status(400).json({ message: 'assignedUserName does not match user name', data: {} });
                }
                req.body.assignedUserName = assignedUser.name;
            }

            // reject modifying a completed task
            if (existing.completed === true) {
                return res.status(400).json({ message: 'Cannot modify a completed task', data: {} });
            }

            // if request is trying to assign a completed task, reject it
            if (req.body.completed === true && req.body.assignedUser) {
                return res.status(400).json({ message: 'Cannot assign a completed task to a user', data: {} });
            }

            // if marking this task as completed, remove it from the user's pendingTasks
            if (req.body.completed === true && existing.assignedUser) {
                const user = await User.findById(existing.assignedUser);
                if (user) {
                    user.pendingTasks = user.pendingTasks.filter(id => id !== existing._id.toString());
                    await user.save();
                }
            }

            const oldUserId = existing.assignedUser;
            const updated = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
            // Remove from old user
            if (oldUserId && oldUserId !== updated.assignedUser) {
                const oldUser = await User.findById(oldUserId);
                if (oldUser) {
                    oldUser.pendingTasks = oldUser.pendingTasks.filter(
                        (id) => id !== updated._id.toString()
                    );
                    await oldUser.save();
                }
            }
    
            // Add to new user
            if (updated.assignedUser && oldUserId !== updated.assignedUser) {
                const newUser = await User.findById(updated.assignedUser);
                if (newUser) {
                    if (!newUser.pendingTasks.includes(updated._id.toString())) {
                        newUser.pendingTasks.push(updated._id.toString());
                        await newUser.save();
                    }
                }
            }
    
            res.status(200).json({ message: 'Task updated', data: updated });
        } catch (err) {
            res.status(404).json({ message: 'Task not found', data: {} });
        }
    });
  
    // DELETE /api/tasks/:id
    tasksIdRoute.delete(async function (req, res) {
        try {
            const deleted = await Task.findByIdAndDelete(req.params.id);
            if (!deleted)
                return res.status(404).json({ message: 'Task not found', data: {} });
    
            // Remove from assigned user's pendingTasks
            if (deleted.assignedUser) {
                const user = await User.findById(deleted.assignedUser);
                if (user) {
                    user.pendingTasks = user.pendingTasks.filter(
                        (id) => id !== deleted._id.toString()
                    );
                    await user.save();
                }
            }
    
            res.status(200).json({ message: 'Task deleted', data: deleted });
        } catch (err) {
            res.status(404).json({ message: 'Task not found', data: {} });
        }
    });
  
    return router;
};
  